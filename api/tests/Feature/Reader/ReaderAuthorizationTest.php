<?php

namespace Tests\Feature\Reader;

use App\Modules\ApiToken\Models\ApiToken;
use App\Modules\ApiToken\Services\ApiTokenService;
use App\Modules\Tenant\Support\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\InteractsWithTenants;
use Tests\TestCase;

class ReaderAuthorizationTest extends TestCase
{
    use InteractsWithTenants;
    use RefreshDatabase;

    private const REDIRECT = 'http://127.0.0.1:53682/callback';

    private string $verifier = 'Zm9vYmFyYmF6cXV4dmVyaWZpZXJfZm9yX3BrY2VfdGVzdHNfMTIzNDU2';

    private function challenge(?string $verifier = null): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier ?? $this->verifier, true)), '+/', '-_'), '=');
    }

    private function authorizeAs($user): string
    {
        Sanctum::actingAs($user);

        $code = $this->postJson('/api/reader/authorize', [
            'redirect_uri' => self::REDIRECT,
            'code_challenge' => $this->challenge(),
            'code_challenge_method' => 'S256',
            'device_name' => 'PC da sala',
        ])->assertOk()->assertJsonPath('data.redirect_uri', self::REDIRECT)->json('data.code');

        $this->app['auth']->forgetGuards();

        return $code;
    }

    public function test_full_flow_issues_an_import_only_token_for_the_users_account(): void
    {
        $tenant = $this->createTenantWithRoles(['name' => 'Maria']);
        $code = $this->authorizeAs($this->createAdmin($tenant));

        $data = $this->postJson('/api/reader/token', [
            'code' => $code, 'code_verifier' => $this->verifier, 'redirect_uri' => self::REDIRECT,
        ])->assertOk()->json('data');

        $this->assertSame('Maria', $data['account']);
        $this->assertStringStartsWith('api_', $data['token']);

        $token = ApiToken::query()->withoutTenancy()->firstOrFail();
        $this->assertSame($tenant->id, $token->tenant_id);
        $this->assertSame(['glucose.import'], $token->permissions);
        $this->assertStringContainsString('PC da sala', $token->name);

        // O token funciona para o leitor e não lê dados.
        $this->withToken($data['token'])->getJson('/api/glucose/reader/whoami')->assertOk()->assertJsonPath('data.account', 'Maria');
        $this->withToken($data['token'])->getJson('/api/glucose/readings')->assertForbidden();
    }

    public function test_code_is_single_use_and_bound_to_verifier_and_redirect(): void
    {
        $code = $this->authorizeAs($this->createAdmin($this->createTenantWithRoles()));

        $this->postJson('/api/reader/token', ['code' => $code, 'code_verifier' => str_repeat('x', 50), 'redirect_uri' => self::REDIRECT])
            ->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->postJson('/api/reader/token', ['code' => $code, 'code_verifier' => $this->verifier, 'redirect_uri' => 'http://127.0.0.1:9999/callback'])
            ->assertUnprocessable();

        $this->postJson('/api/reader/token', ['code' => $code, 'code_verifier' => $this->verifier, 'redirect_uri' => self::REDIRECT])->assertOk();
        $this->postJson('/api/reader/token', ['code' => $code, 'code_verifier' => $this->verifier, 'redirect_uri' => self::REDIRECT])
            ->assertUnprocessable();
        $this->assertSame(1, ApiToken::query()->withoutTenancy()->count());
    }

    public function test_code_expires_after_five_minutes(): void
    {
        $code = $this->authorizeAs($this->createAdmin($this->createTenantWithRoles()));
        $this->travel(6)->minutes();

        $this->postJson('/api/reader/token', ['code' => $code, 'code_verifier' => $this->verifier, 'redirect_uri' => self::REDIRECT])
            ->assertUnprocessable();
    }

    public function test_only_loopback_redirects_and_s256_are_accepted(): void
    {
        Sanctum::actingAs($this->createAdmin($this->createTenantWithRoles()));

        foreach (['https://evil.example.com/callback', 'http://localhost:5000/callback', 'http://127.0.0.1:5000/outro', 'http://127.0.0.1.evil.com:80/callback'] as $uri) {
            $this->postJson('/api/reader/authorize', ['redirect_uri' => $uri, 'code_challenge' => $this->challenge(), 'code_challenge_method' => 'S256'])
                ->assertUnprocessable()->assertJsonValidationErrors('redirect_uri');
        }
        $this->postJson('/api/reader/authorize', ['redirect_uri' => self::REDIRECT, 'code_challenge' => $this->challenge(), 'code_challenge_method' => 'plain'])
            ->assertUnprocessable();
    }

    public function test_authorization_requires_a_logged_in_person_not_an_api_token(): void
    {
        $tenant = $this->createTenantWithRoles();
        $body = ['redirect_uri' => self::REDIRECT, 'code_challenge' => $this->challenge(), 'code_challenge_method' => 'S256'];

        $this->postJson('/api/reader/authorize', $body)->assertUnauthorized();

        app(CurrentTenant::class)->set($tenant);
        $plain = app(ApiTokenService::class)->issue('leitor', null, ['glucose.import'])->plainTextToken;
        $this->forgetTenantContext();

        $this->withToken($plain)->postJson('/api/reader/authorize', $body)->assertForbidden();
    }
}
