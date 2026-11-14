<?php

namespace App\Modules\Reader\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ExchangeReaderCodeRequest extends FormRequest
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
            'code' => ['required', 'string', 'max:128'],
            'code_verifier' => ['required', 'string', 'regex:/^[A-Za-z0-9._~-]{43,128}$/'],
            'redirect_uri' => ['required', 'string', 'max:255'],
        ];
    }
}
