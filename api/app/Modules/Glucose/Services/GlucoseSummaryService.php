<?php

namespace App\Modules\Glucose\Services;

use App\Modules\Glucose\Enums\GlucoseRange;
use App\Modules\Glucose\Models\GlucoseReading;

/**
 * Estatísticas de um período: média, variabilidade, tempo em cada faixa,
 * GMI (A1c estimada), série diária e perfil por hora do dia.
 */
class GlucoseSummaryService
{
    public function __construct(private readonly GlucoseReadingService $readings) {}

    /**
     * @return array<string, mixed>
     */
    public function summarize(?string $from, ?string $to): array
    {
        $rows = $this->readings->query(['from' => $from, 'to' => $to])
            ->orderBy('measured_at')
            ->get(['measured_at', 'value_mg_dl']);

        $values = $rows->pluck('value_mg_dl')->map(fn ($v) => (int) $v)->all();
        $count = count($values);

        $ranges = array_fill_keys(array_map(fn (GlucoseRange $r) => $r->value, GlucoseRange::cases()), 0);
        foreach ($values as $value) {
            $ranges[GlucoseRange::classify($value)->value]++;
        }

        $mean = $count > 0 ? array_sum($values) / $count : null;
        $stdDev = null;
        if ($count > 1) {
            $variance = array_sum(array_map(fn ($v) => ($v - $mean) ** 2, $values)) / ($count - 1);
            $stdDev = sqrt($variance);
        }

        $daily = $rows
            ->groupBy(fn (GlucoseReading $r) => $r->measured_at->format('Y-m-d'))
            ->map(fn ($group, $date) => [
                'date' => $date,
                'count' => $group->count(),
                'mean' => round($group->avg('value_mg_dl'), 1),
                'min' => (int) $group->min('value_mg_dl'),
                'max' => (int) $group->max('value_mg_dl'),
            ])
            ->values();

        $hourly = collect(range(0, 23))->map(function (int $hour) use ($rows) {
            $group = $rows->filter(fn (GlucoseReading $r) => (int) $r->measured_at->format('G') === $hour);

            return [
                'hour' => $hour,
                'count' => $group->count(),
                'mean' => $group->isEmpty() ? null : round($group->avg('value_mg_dl'), 1),
            ];
        });

        $last = GlucoseReading::query()->orderByDesc('measured_at')->first(['measured_at', 'value_mg_dl']);

        return [
            'period' => [
                'from' => $from,
                'to' => $to,
                'first_at' => $rows->first()?->measured_at?->format('Y-m-d\TH:i:s'),
                'last_at' => $rows->last()?->measured_at?->format('Y-m-d\TH:i:s'),
            ],
            'targets' => config('glucose.ranges'),
            'count' => $count,
            'mean' => $mean === null ? null : round($mean, 1),
            'median' => $this->median($values),
            'min' => $count ? min($values) : null,
            'max' => $count ? max($values) : null,
            'std_dev' => $stdDev === null ? null : round($stdDev, 1),
            'cv' => ($stdDev !== null && $mean > 0) ? round($stdDev / $mean * 100, 1) : null,
            /* Glucose Management Indicator (Bergenstal et al., 2018). */
            'gmi' => $mean === null ? null : round(3.31 + 0.02392 * $mean, 1),
            'ranges' => collect($ranges)->map(fn (int $n) => [
                'count' => $n,
                'percent' => $count ? round($n / $count * 100, 1) : 0.0,
            ])->all(),
            'daily' => $daily,
            'hourly' => $hourly,
            'latest' => $last ? [
                'measured_at' => $last->measured_at->format('Y-m-d\TH:i:s'),
                'value_mg_dl' => (int) $last->value_mg_dl,
                'range' => GlucoseRange::classify((int) $last->value_mg_dl)->value,
            ] : null,
        ];
    }

    /**
     * @param  list<int>  $values
     */
    private function median(array $values): ?float
    {
        $n = count($values);
        if ($n === 0) {
            return null;
        }

        sort($values);
        $mid = intdiv($n, 2);

        return $n % 2 ? (float) $values[$mid] : ($values[$mid - 1] + $values[$mid]) / 2;
    }
}
