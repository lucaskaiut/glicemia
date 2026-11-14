<?php

namespace App\Modules\Glucose\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGlucoseDeviceRequest extends FormRequest
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
            'name' => ['sometimes', 'nullable', 'string', 'max:120'],
            /* Até ±5 anos, cobre aparelhos com relógio zerado. */
            'clock_offset_seconds' => ['sometimes', 'integer', 'between:-157788000,157788000'],
            /* Substitui todos os períodos do relógio. */
            'clock_offsets' => ['sometimes', 'array', 'min:1', 'max:50'],
            'clock_offsets.*.from_sequence' => ['required_with:clock_offsets', 'integer', 'min:1'],
            'clock_offsets.*.offset_seconds' => ['required_with:clock_offsets', 'integer', 'between:-157788000,157788000'],
            /* Novo período a partir da 1ª medição com horário do aparelho >= este. */
            'split_at_device_time' => ['sometimes', 'date'],
            'split_offset_seconds' => ['required_with:split_at_device_time', 'integer', 'between:-157788000,157788000'],
            /* O relógio do aparelho foi acertado agora. */
            'clock_fixed' => ['sometimes', 'accepted'],
        ];
    }
}
