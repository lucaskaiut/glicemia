<?php

namespace App\Modules\Glucose\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImportGlucoseReadingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'device' => ['required', 'array'],
            'device.model' => ['required', 'string', 'max:80'],
            'device.identifier' => ['required', 'string', 'max:120'],
            'device.name' => ['nullable', 'string', 'max:120'],
            'readings' => ['present', 'array', 'max:'.config('glucose.import_max_readings')],
            'readings.*.device_measured_at' => ['required', 'date_format:Y-m-d\TH:i,Y-m-d\TH:i:s,Y-m-d H:i,Y-m-d H:i:s'],
            'readings.*.value_mg_dl' => ['required', 'integer', 'min:10', 'max:1000'],
            'readings.*.meal_tag' => ['nullable', 'integer', 'min:0', 'max:255'],
        ];
    }
}
