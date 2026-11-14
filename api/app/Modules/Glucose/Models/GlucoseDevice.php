<?php

namespace App\Modules\Glucose\Models;

use App\Modules\Shared\Models\Concerns\HasUuid;
use App\Modules\Tenant\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GlucoseDevice extends Model
{
    use BelongsToTenant;
    use HasUuid;

    protected $attributes = [
        'clock_offset_seconds' => 0,
    ];

    protected $fillable = [
        'model',
        'identifier',
        'name',
        'clock_offset_seconds',
        'clock_offsets',
        'last_synced_at',
        'last_sync_result',
    ];

    protected function casts(): array
    {
        return [
            'clock_offset_seconds' => 'integer',
            'clock_offsets' => 'array',
            'last_synced_at' => 'datetime',
            'last_sync_result' => 'array',
        ];
    }

    /**
     * Períodos do relógio, ordenados. O primeiro sempre começa na sequência 1.
     *
     * @return list<array{from_sequence: int, offset_seconds: int}>
     */
    public function clockPeriods(): array
    {
        $periods = $this->clock_offsets ?: [['from_sequence' => 1, 'offset_seconds' => (int) $this->clock_offset_seconds]];

        return array_values(collect($periods)->sortBy('from_sequence')->all());
    }

    public function offsetForSequence(?int $sequence): int
    {
        $offset = 0;
        foreach ($this->clockPeriods() as $period) {
            if ($sequence === null || $period['from_sequence'] <= $sequence) {
                $offset = (int) $period['offset_seconds'];
            }
        }

        return $offset;
    }

    /**
     * @return HasMany<GlucoseReading, $this>
     */
    public function readings(): HasMany
    {
        return $this->hasMany(GlucoseReading::class);
    }
}
