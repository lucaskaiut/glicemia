<?php

namespace Tests\Feature\Auth;

use App\Modules\Tenant\Models\Tenant;
use App\Modules\User\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Maria Souza',
            'email' => 'maria@example.com',
            'password' => 'senha-segura-123',
            'password_confirmation' => 'senha-segura-123',
            'accept_terms' => true,
            ...$overrides,
        ];
    }

    public function test_register_creates_an_independent_free_account(): void
    {
        $this->postJson('/api/auth/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.user.email', 'maria@example.com')
            ->assertJsonPath('data.requires_payment', false);

        $user = User::query()->where('email', 'maria@example.com')->firstOrFail();
        $tenant = Tenant::query()->findOrFail($user->tenant_id);

        $this->assertNull($tenant->parent_id);
        $this->assertFalse((bool) $user->is_master);
        $this->assertTrue(Hash::check('senha-segura-123', $user->password));
        $this->assertContains('glucose.import', $user->permissionValues()->all());
    }

    public function test_every_account_is_independent_and_nobody_is_master(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertCreated();
        $this->postJson('/api/auth/register', $this->payload(['email' => 'joao@example.com', 'name' => 'João']))->assertCreated();

        $this->assertSame(0, Tenant::query()->whereNotNull('parent_id')->count());
        $this->assertSame(0, User::query()->where('is_master', true)->count());
    }

    public function test_register_validates_input(): void
    {
        $this->postJson('/api/auth/register', $this->payload(['password_confirmation' => 'outra']))
            ->assertUnprocessable();
        $this->postJson('/api/auth/register', $this->payload(['accept_terms' => false]))
            ->assertUnprocessable();

        $this->postJson('/api/auth/register', $this->payload())->assertCreated();
        $this->postJson('/api/auth/register', $this->payload())
            ->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Já existe uma conta com este e-mail.');
    }

    public function test_billing_and_child_account_routes_are_not_exposed(): void
    {
        $this->postJson('/api/auth/register', $this->payload())->assertCreated();
        $user = User::query()->firstOrFail();
        $this->actingAs($user);

        $this->getJson('/api/billing/plans')->assertNotFound();
        $this->getJson('/api/tenant/children')->assertNotFound();
        $this->postJson('/api/users', [])->assertStatus(405);
    }
}
