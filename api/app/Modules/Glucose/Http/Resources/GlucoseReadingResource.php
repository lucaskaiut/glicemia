<?php

namespace App\Modules\Glucose\Http\Resources;

use App\Modules\Glucose\Models\GlucoseReading;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin GlucoseReading
 */
class GlucoseReadingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'measured_at' => $this->measured_at->format('Y-m-d\TH:i:s'),
            'device_measured_at' => $this->device_measured_at?->format('Y-m-d\TH:i:s'),
            'value_mg_dl' => $this->value_mg_dl,
            'range' => $this->range()->value,
            'meal_tag' => $this->meal_tag->key(),
            'source' => $this->source,
            'notes' => $this->notes,
            'device' => $this->whenLoaded('device', fn () => $this->device ? [
                'id' => $this->device->uuid,
                'model' => $this->device->model,
                'name' => $this->device->name,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
