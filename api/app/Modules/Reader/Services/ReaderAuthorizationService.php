<?php

namespace App\Modules\Reader\Services;

use App\Modules\ACL\Enums\Permission;
use App\Modules\ApiToken\Services\ApiTokenService;
use App\Modules\Reader\Models\ReaderAuthorization;
use App\Modules\Tenant\Models\Tenant;
use App\Modules\Tenant\Support\CurrentTenant;
use App\Modules\User\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * "Entrar com o Glicemia" no app desktop — OAuth para apps nativos (RFC 8252):
 *
 * 1. O app abre o navegador no painel com redirect_uri de loopback (http://127.0.0.1:PORTA/callback)
 *    e o code_challenge (PKCE S256).
 * 2. A pessoa, logada no painel, permite: emitimos um código de uso único (5 min).
 * 3. O app troca código + code_verifier por um token que só pode importar medições.
 */
class ReaderAuthorizationService
{
    public const LOOPBACK_PATTERN = '#^http://127\.0\.0\.1:([0-9]{2,5})/callback$#';

    private const CODE_TTL_MINUTES = 5;

    public function __construct(
        private readonly ApiTokenService $tokens,
        private readonly CurrentTenant $context,
    ) {}

    /**
     * @return array{code: string, redirect_uri: string}
     */
    public function authorize(User $user, string $redirectUri, string $codeChallenge, ?string $deviceName): array
    {
        $code = Str::random(48);

        ReaderAuthorization::query()->create([
            'user_id' => $user->getKey(),
            'code_hash' => hash('sha256', $code),
            'code_challenge' => $codeChallenge,
            'redirect_uri' => $redirectUri,
            'device_name' => $deviceName,
            'expires_at' => now()->addMinutes(self::CODE_TTL_MINUTES),
        ]);

        return ['code' => $code, 'redirect_uri' => $redirectUri];
    }

    /**
     * @return array{token: string, account: string}
     */
    public function exchange(string $code, string $codeVerifier, string $redirectUri): array
    {
        return DB::transaction(function () use ($code, $codeVerifier, $redirectUri) {
            $auth = ReaderAuthorization::query()
                ->withoutTenancy()
                ->where('code_hash', hash('sha256', $code))
                ->lockForUpdate()
                ->first();

            $challenge = rtrim(strtr(base64_encode(hash('sha256', $codeVerifier, true)), '+/', '-_'), '=');

            $valid = $auth !== null
                && $auth->used_at === null
                && $auth->expires_at->isFuture()
                && hash_equals($auth->redirect_uri, $redirectUri)
                && hash_equals($auth->code_challenge, $challenge);

            if (! $valid) {
                throw ValidationException::withMessages([
                    'code' => 'Autorização inválida ou expirada. Tente conectar de novo.',
                ]);
            }

            $auth->forceFill(['used_at' => now()])->save();

            /** @var Tenant $tenant */
            $tenant = Tenant::query()->findOrFail($auth->tenant_id);
            $this->context->set($tenant);

            $name = 'App Glicemia — '.($auth->device_name ?: 'computador').' ('.now()->format('d/m/Y').')';
            $issued = $this->tokens->issue($name, null, [Permission::GLUCOSE_IMPORT->value]);

            return ['token' => $issued->plainTextToken, 'account' => $tenant->name];
        });
    }
}
