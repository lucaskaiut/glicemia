<?php

namespace App\Modules\Glucose\Http\Requests;

use App\Modules\Glucose\Enums\MealTag;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGlucoseReadingRequest extends FormRequest
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
            'measured_at' => ['required', 'date'],
            'value_mg_dl' => ['required', 'integer', 'min:10', 'max:1000'],
            'meal_tag' => ['nullable', Rule::in(MealTag::keys())],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
