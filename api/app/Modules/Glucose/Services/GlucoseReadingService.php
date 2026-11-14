<?php

namespace App\Modules\Glucose\Services;

use App\Modules\Glucose\Enums\GlucoseRange;
use App\Modules\Glucose\Enums\MealTag;
use App\Modules\Glucose\Models\GlucoseReading;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class GlucoseReadingService
{
    /**
     * @param  array{from?: ?string, to?: ?string, range?: ?string, meal_tag?: ?string}  $filters
     */
    public function paginate(array $filters, int $perPage = 25, ?int $page = null): LengthAwarePaginator
    {
        return $this->query($filters)
            ->with('device:id,uuid,model,name')
            ->orderByDesc('measured_at')
            ->orderByDesc('id')
            ->paginate(min(max($perPage, 1), 200), ['*'], 'page', $page);
    }

    /**
     * @param  array{from?: ?string, to?: ?string, range?: ?string, meal_tag?: ?string}  $filters
     * @return Builder<GlucoseReading>
     */
    public function query(array $filters): Builder
    {
        $ranges = config('glucose.ranges');

        return GlucoseReading::query()
            ->when($filters['from'] ?? null, fn (Builder $q, string $from) => $q->where('measured_at', '>=', $from.' 00:00:00'))
            ->when($filters['to'] ?? null, fn (Builder $q, string $to) => $q->where('measured_at', '<=', $to.' 23:59:59'))
            ->when($filters['meal_tag'] ?? null, fn (Builder $q, string $tag) => $q->where('meal_tag', MealTag::fromKey($tag)->value))
            ->when($filters['range'] ?? null, function (Builder $q, string $range) use ($ranges): void {
                match (GlucoseRange::tryFrom($range)) {
                    GlucoseRange::VERY_LOW => $q->where('value_mg_dl', '<', $ranges['very_low']),
                    GlucoseRange::LOW => $q->where('value_mg_dl', '>=', $ranges['very_low'])->where('value_mg_dl', '<', $ranges['low']),
                    GlucoseRange::IN_RANGE => $q->whereBetween('value_mg_dl', [$ranges['low'], $ranges['high']]),
                    GlucoseRange::HIGH => $q->where('value_mg_dl', '>', $ranges['high'])->where('value_mg_dl', '<=', $ranges['very_high']),
                    GlucoseRange::VERY_HIGH => $q->where('value_mg_dl', '>', $ranges['very_high']),
                    default => null,
                };
            });
    }

    /**
     * @param  array{measured_at: string, value_mg_dl: int, meal_tag?: ?string, notes?: ?string}  $data
     */
    public function createManual(array $data): GlucoseReading
    {
        return GlucoseReading::query()->create([
            'measured_at' => $data['measured_at'],
            'value_mg_dl' => $data['value_mg_dl'],
            'meal_tag' => MealTag::fromKey($data['meal_tag'] ?? 'none'),
            'notes' => $data['notes'] ?? null,
            'source' => GlucoseReading::SOURCE_MANUAL,
        ]);
    }

    /**
     * @param  array{meal_tag?: ?string, notes?: ?string}  $data
     */
    public function update(GlucoseReading $reading, array $data): GlucoseReading
    {
        if (array_key_exists('meal_tag', $data)) {
            $reading->meal_tag = MealTag::fromKey((string) $data['meal_tag']);
        }

        if (array_key_exists('notes', $data)) {
            $reading->notes = $data['notes'];
        }

        $reading->save();

        return $reading->refresh()->load('device:id,uuid,model,name');
    }

    public function delete(GlucoseReading $reading): void
    {
        $reading->delete();
    }
}
