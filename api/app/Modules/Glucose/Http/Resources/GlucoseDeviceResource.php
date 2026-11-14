<?php

namespace App\Modules\Glucose\Http\Resources;

use App\Modules\Glucose\Models\GlucoseDevice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin GlucoseDevice
 */
class GlucoseDeviceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'model' => $this->model,
            'identifier' => $this->identifier,
            'name' => $this->name,
            'clock_offset_seconds' => $this->clock_offset_seconds,
            'clock_periods' => $this->periodsWithBoundaries(),
            'readings_count' => $this->whenCounted('readings'),
            'last_synced_at' => $this->last_synced_at?->toIso8601String(),
            'last_sync_result' => $this->last_sync_result,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Cada período com a medição onde começa e onde termina (para o painel exibir).
     *
     * @return list<array<string, mixed>>
     */
    private function periodsWithBoundaries(): array
    {
        $periods = $this->resource->clockPeriods();
        $out = [];

        foreach ($periods as $i => $period) {
            $to = isset($periods[$i + 1]) ? $periods[$i + 1]['from_sequence'] - 1 : null;
            $range = $this->resource->readings()
                ->where('device_sequence', '>=', $period['from_sequence'])
                ->when($to !== null, fn ($q) => $q->where('device_sequence', '<=', $to));

            $first = (clone $range)->orderBy('device_sequence')->first(['device_measured_at', 'measured_at', 'value_mg_dl']);
            $last = (clone $range)->orderByDesc('device_sequence')->first(['device_measured_at', 'measured_at', 'value_mg_dl']);

            $out[] = [
                'from_sequence' => $period['from_sequence'],
                'offset_seconds' => $period['offset_seconds'],
                'readings_count' => (clone $range)->count(),
                'first' => $first ? ['device_measured_at' => $first->device_measured_at->format('Y-m-d\TH:i:s'), 'measured_at' => $first->measured_at->format('Y-m-d\TH:i:s'), 'value_mg_dl' => $first->value_mg_dl] : null,
                'last' => $last ? ['device_measured_at' => $last->device_measured_at->format('Y-m-d\TH:i:s'), 'measured_at' => $last->measured_at->format('Y-m-d\TH:i:s'), 'value_mg_dl' => $last->value_mg_dl] : null,
            ];
        }

        return $out;
    }
}
