<?php

namespace App\Modules\Glucose\Http\Requests;

use App\Modules\Glucose\Enums\MealTag;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateGlucoseReadingRequest extends FormRequest
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
            'meal_tag' => ['sometimes', Rule::in(MealTag::keys())],
            'notes' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
