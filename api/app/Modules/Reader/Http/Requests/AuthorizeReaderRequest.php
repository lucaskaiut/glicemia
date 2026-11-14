<?php

namespace App\Modules\Reader\Http\Requests;

use App\Modules\Reader\Services\ReaderAuthorizationService;
use Illuminate\Foundation\Http\FormRequest;

class AuthorizeReaderRequest extends FormRequest
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
            // Só loopback: o código nunca sai do computador da pessoa.
            'redirect_uri' => ['required', 'string', 'max:255', 'regex:'.ReaderAuthorizationService::LOOPBACK_PATTERN],
            'code_challenge' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{43}$/'],
            'code_challenge_method' => ['required', 'in:S256'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ];
    }
}
