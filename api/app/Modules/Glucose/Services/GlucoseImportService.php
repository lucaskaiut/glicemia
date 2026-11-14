<?php

namespace App\Modules\Glucose\Services;

use App\Modules\Glucose\Enums\MealTag;
use App\Modules\Glucose\Models\GlucoseDevice;
use App\Modules\Glucose\Models\GlucoseReading;
use App\Modules\Tenant\Support\Facades\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Recebe o despejo de memória de um glicosímetro e grava só o que é novo.
 *
 * O aparelho reenvia toda a memória a cada leitura e o índice dele muda a cada
 * nova medição, então a deduplicação usa (aparelho, horário do aparelho, valor).
 *
 * Cada medição recebe uma sequência estável (posição cronológica na memória), que
 * define a qual período de relógio ela pertence — o relógio do aparelho pode pular
 * e até voltar no tempo, então o horário dele não serve para delimitar períodos.
 */
class GlucoseImportService
{
    /**
     * @param  array{model: string, identifier: string, name?: ?string}  $deviceData
     * @param  list<array{device_measured_at: string, value_mg_dl: int, meal_tag?: int}>  $readings  ordem da memória: mais recente primeiro
     * @return array{device: GlucoseDevice, received: int, created: int, duplicates: int}
     */
    public function import(array $deviceData, array $readings): array
    {
        return DB::transaction(function () use ($deviceData, $readings) {
            // Por enquanto, um aparelho por conta.
            $other = GlucoseDevice::query()
                ->where(fn ($q) => $q->where('model', '!=', $deviceData['model'])->orWhere('identifier', '!=', $deviceData['identifier']))
                ->first();
            if ($other !== null) {
                throw ValidationException::withMessages([
                    'device' => 'Esta conta já tem um glicosímetro cadastrado ('.($other->name ?: $other->model).'). Use uma conta para cada aparelho.',
                ]);
            }

            $device = GlucoseDevice::query()->firstOrCreate(
                ['model' => $deviceData['model'], 'identifier' => $deviceData['identifier']],
                ['name' => $deviceData['name'] ?? null],
            );

            /** @var array<string, int|null> $existing chave => sequência */
            $existing = GlucoseReading::query()
                ->where('glucose_device_id', $device->getKey())
                ->get(['device_measured_at', 'value_mg_dl', 'device_sequence'])
                ->mapWithKeys(fn (GlucoseReading $r) => [
                    $this->key($r->device_measured_at->format('Y-m-d H:i:s'), $r->value_mg_dl) => $r->device_sequence,
                ])
                ->all();

            $total = count($readings);
            $entries = [];
            foreach (array_values($readings) as $i => $reading) {
                $deviceAt = CarbonImmutable::parse($reading['device_measured_at'])->format('Y-m-d H:i:s');
                $entries[] = [
                    'reading' => $reading,
                    'device_at' => $deviceAt,
                    'key' => $this->key($deviceAt, (int) $reading['value_mg_dl']),
                    'position' => $total - $i, // 1 = mais antiga do despejo
                ];
            }

            $base = $this->sequenceBase($device, $entries, $existing);

            $now = now();
            $rows = [];

            foreach ($entries as $entry) {
                if (array_key_exists($entry['key'], $existing)) {
                    continue;
                }

                $existing[$entry['key']] = null;
                $sequence = $base + $entry['position'];

                $rows[] = [
                    'uuid' => (string) Str::uuid(),
                    'tenant_id' => TenantContext::tenantId(),
                    'glucose_device_id' => $device->getKey(),
                    'device_measured_at' => $entry['device_at'],
                    'device_sequence' => $sequence,
                    'measured_at' => $this->applyOffset($entry['device_at'], $device->offsetForSequence($sequence)),
                    'value_mg_dl' => (int) $entry['reading']['value_mg_dl'],
                    'meal_tag' => MealTag::tryFrom((int) ($entry['reading']['meal_tag'] ?? 0))?->value ?? MealTag::NONE->value,
                    'source' => GlucoseReading::SOURCE_DEVICE,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($rows, 500) as $chunk) {
                GlucoseReading::query()->insert($chunk);
            }

            $result = [
                'received' => $total,
                'created' => count($rows),
                'duplicates' => $total - count($rows),
            ];

            $device->forceFill([
                'last_synced_at' => $now,
                'last_sync_result' => $result,
            ])->save();

            return ['device' => $device, ...$result];
        });
    }

    /**
     * Alinha as posições do despejo com as sequências já gravadas, usando a medição
     * conhecida mais recente como âncora. Sem âncora, continua depois da maior sequência.
     *
     * @param  list<array{key: string, position: int}>  $entries
     * @param  array<string, int|null>  $existing
     */
    private function sequenceBase(GlucoseDevice $device, array $entries, array $existing): int
    {
        $anchor = null;
        foreach ($entries as $entry) {
            $sequence = $existing[$entry['key']] ?? null;
            if ($sequence !== null && ($anchor === null || $entry['position'] > $anchor['position'])) {
                $anchor = ['position' => $entry['position'], 'sequence' => $sequence];
            }
        }

        if ($anchor !== null) {
            return $anchor['sequence'] - $anchor['position'];
        }

        return (int) GlucoseReading::query()->where('glucose_device_id', $device->getKey())->max('device_sequence');
    }

    /**
     * Substitui os períodos do relógio e recalcula measured_at de todas as leituras do aparelho.
     *
     * @param  list<array{from_sequence: int, offset_seconds: int}>  $periods
     */
    public function updateClockPeriods(GlucoseDevice $device, array $periods): GlucoseDevice
    {
        $normalized = collect($periods)
            ->map(fn (array $p) => ['from_sequence' => max(1, (int) $p['from_sequence']), 'offset_seconds' => (int) $p['offset_seconds']])
            ->keyBy('from_sequence') // em caso de repetição, o último vence
            ->sortKeys()
            ->values()
            ->all();

        if ($normalized === []) {
            $normalized = [['from_sequence' => 1, 'offset_seconds' => 0]];
        }
        $normalized[0]['from_sequence'] = 1;

        return DB::transaction(function () use ($device, $normalized) {
            $device->forceFill([
                'clock_offsets' => $normalized,
                'clock_offset_seconds' => end($normalized)['offset_seconds'],
            ])->save();

            $device->readings()
                ->whereNotNull('device_measured_at')
                ->select(['id', 'device_measured_at', 'device_sequence'])
                ->chunkById(500, function ($readings) use ($device): void {
                    foreach ($readings as $reading) {
                        GlucoseReading::query()->whereKey($reading->getKey())->update([
                            'measured_at' => $this->applyOffset(
                                $reading->device_measured_at->format('Y-m-d H:i:s'),
                                $device->offsetForSequence($reading->device_sequence),
                            ),
                        ]);
                    }
                });

            return $device->refresh();
        });
    }

    /** Ajusta só o período atual (o último) — é o que o relógio do aparelho mostra hoje. */
    public function updateClockOffset(GlucoseDevice $device, int $offsetSeconds): GlucoseDevice
    {
        $periods = $device->clockPeriods();
        $periods[count($periods) - 1]['offset_seconds'] = $offsetSeconds;

        return $this->updateClockPeriods($device, $periods);
    }

    /**
     * Inicia um novo período a partir da primeira medição (em ordem de memória) cujo
     * horário do aparelho é >= $deviceTime. Útil quando o relógio deu um salto.
     */
    public function splitAtDeviceTime(GlucoseDevice $device, string $deviceTime, int $offsetSeconds): GlucoseDevice
    {
        $sequence = $device->readings()
            ->where('device_measured_at', '>=', CarbonImmutable::parse($deviceTime)->format('Y-m-d H:i:s'))
            ->min('device_sequence');

        if ($sequence === null || (int) $sequence <= 1) {
            throw ValidationException::withMessages([
                'split_at_device_time' => 'Nenhuma medição a partir desse horário (ou ela já é a primeira).',
            ]);
        }

        return $this->updateClockPeriods($device, [
            ...$device->clockPeriods(),
            ['from_sequence' => (int) $sequence, 'offset_seconds' => $offsetSeconds],
        ]);
    }

    /**
     * O relógio do aparelho foi acertado agora: medições a partir da próxima já vêm certas.
     */
    public function markClockFixed(GlucoseDevice $device): GlucoseDevice
    {
        $next = (int) $device->readings()->max('device_sequence') + 1;

        return $this->updateClockPeriods($device, [
            ...$device->clockPeriods(),
            ['from_sequence' => $next, 'offset_seconds' => 0],
        ]);
    }

    private function applyOffset(string $deviceAt, int $offsetSeconds): string
    {
        return CarbonImmutable::parse($deviceAt)->addSeconds($offsetSeconds)->format('Y-m-d H:i:s');
    }

    private function key(string $deviceAt, int $value): string
    {
        return $deviceAt.'|'.$value;
    }
}
