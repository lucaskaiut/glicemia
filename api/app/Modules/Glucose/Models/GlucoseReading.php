<?php

namespace App\Modules\Glucose\Models;

use App\Modules\Glucose\Enums\GlucoseRange;
use App\Modules\Glucose\Enums\MealTag;
use App\Modules\Shared\Models\Concerns\HasUuid;
use App\Modules\Tenant\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GlucoseReading extends Model
{
    public const SOURCE_DEVICE = 'device';

    public const SOURCE_MANUAL = 'manual';

    use BelongsToTenant;
    use HasUuid;

    protected $fillable = [
        'glucose_device_id',
        'measured_at',
        'device_measured_at',
        'device_sequence',
        'value_mg_dl',
        'meal_tag',
        'source',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'measured_at' => 'datetime',
            'device_measured_at' => 'datetime',
            'value_mg_dl' => 'integer',
            'device_sequence' => 'integer',
            'meal_tag' => MealTag::class,
        ];
    }

    /**
     * @return BelongsTo<GlucoseDevice, $this>
     */
    public function device(): BelongsTo
    {
        return $this->belongsTo(GlucoseDevice::class, 'glucose_device_id');
    }

    public function range(): GlucoseRange
    {
        return GlucoseRange::classify($this->value_mg_dl);
    }
}
