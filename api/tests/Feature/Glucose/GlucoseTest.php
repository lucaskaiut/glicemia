<?php

namespace Tests\Feature\Glucose;

use App\Modules\ApiToken\Services\ApiTokenService;
use App\Modules\Glucose\Models\GlucoseDevice;
use App\Modules\Glucose\Models\GlucoseReading;
use App\Modules\Tenant\Models\Tenant;
use App\Modules\Tenant\Support\CurrentTenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\InteractsWithTenants;
use Tests\TestCase;

class GlucoseTest extends TestCase
{
    use InteractsWithTenants;
    use RefreshDatabase;

    private function issueToken(Tenant $tenant, ?array $permissions = ['glucose.import']): string
    {
        app(CurrentTenant::class)->set($tenant);
        $plain = app(ApiTokenService::class)->issue('leitor', null, $permissions)->plainTextToken;
        $this->forgetTenantContext();

        return $plain;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $readings): array
    {
        return [
            'device' => ['model' => 'okmeter-match-ii', 'identifier' => 'default', 'name' => 'OK Meter'],
            'readings' => $readings,
        ];
    }

    private function sampleReadings(): array
    {
        return [
            ['device_measured_at' => '2027-11-13T09:10', 'value_mg_dl' => 150, 'meal_tag' => 0],
            ['device_measured_at' => '2027-11-13T07:05', 'value_mg_dl' => 172, 'meal_tag' => 0],
            ['device_measured_at' => '2027-11-12T19:20', 'value_mg_dl' => 98, 'meal_tag' => 1],
        ];
    }

    public function test_reader_imports_with_api_token_and_deduplicates(): void
    {
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant);

        $first = $this->withToken($token)->postJson('/api/glucose/import', $this->payload($this->sampleReadings()))
            ->assertOk()
            ->json('data');

        $this->assertSame(3, $first['received']);
        $this->assertSame(3, $first['created']);
        $this->assertSame(0, $first['duplicates']);

        $readings = $this->sampleReadings();
        $readings[] = ['device_measured_at' => '2027-11-14T08:00', 'value_mg_dl' => 120];

        $second = $this->withToken($token)->postJson('/api/glucose/import', $this->payload($readings))
            ->assertOk()
            ->json('data');

        $this->assertSame(1, $second['created']);
        $this->assertSame(3, $second['duplicates']);
        $this->assertSame(4, GlucoseReading::query()->withoutTenancy()->where('tenant_id', $tenant->id)->count());

        $device = GlucoseDevice::query()->withoutTenancy()->firstOrFail();
        $this->assertSame(['received' => 4, 'created' => 1, 'duplicates' => 3], $device->last_sync_result);
    }

    public function test_unknown_meal_codes_from_device_are_stored_as_none(): void
    {
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant);

        $this->withToken($token)->postJson('/api/glucose/import', $this->payload([
            ['device_measured_at' => '2027-11-13T09:10', 'value_mg_dl' => 150, 'meal_tag' => 7],
        ]))->assertOk()->assertJsonPath('data.created', 1);

        $this->assertDatabaseHas('glucose_readings', ['value_mg_dl' => 150, 'meal_tag' => 0]);
    }

    public function test_an_account_accepts_a_single_device(): void
    {
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant);
        $this->withToken($token)->postJson('/api/glucose/import', $this->payload($this->sampleReadings()))->assertOk();

        $other = $this->payload([['device_measured_at' => '2027-11-14T08:00', 'value_mg_dl' => 100]]);
        $other['device']['identifier'] = 'outro-aparelho';

        $this->withToken($token)->postJson('/api/glucose/import', $other)
            ->assertUnprocessable()
            ->assertJsonPath('errors.device.0', fn ($m) => str_contains($m, 'já tem um glicosímetro'));
        $this->assertSame(3, GlucoseReading::query()->withoutTenancy()->count());
    }

    public function test_reader_whoami_identifies_the_account_without_exposing_readings(): void
    {
        $tenant = $this->createTenantWithRoles(['name' => 'Maria']);
        $token = $this->issueToken($tenant);

        $this->withToken($token)->getJson('/api/glucose/reader/whoami')
            ->assertOk()
            ->assertJsonPath('data.account', 'Maria')
            ->assertJsonPath('data.device', null);

        $this->flushHeaders();
        $this->withToken($this->issueToken($tenant, ['glucose.read']))->getJson('/api/glucose/reader/whoami')->assertForbidden();
    }

    public function test_token_without_import_scope_is_rejected(): void
    {
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant, ['glucose.read']);

        $this->withToken($token)->postJson('/api/glucose/import', $this->payload($this->sampleReadings()))
            ->assertForbidden();
    }

    public function test_invalid_readings_are_rejected(): void
    {
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant);

        $this->withToken($token)->postJson('/api/glucose/import', $this->payload([
            ['device_measured_at' => 'ontem', 'value_mg_dl' => 5000],
        ]))->assertUnprocessable();
    }

    public function test_clock_offset_recalculates_measured_at(): void
    {
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant);
        $this->withToken($token)->postJson('/api/glucose/import', $this->payload($this->sampleReadings()))->assertOk();

        $this->flushHeaders();
        Sanctum::actingAs($this->createAdmin($tenant));

        $device = $this->getJson('/api/glucose/devices')->assertOk()->json('data.0');
        $this->assertSame(3, $device['readings_count']);

        // Relógio do aparelho 365 dias adiantado.
        $this->patchJson("/api/glucose/devices/{$device['id']}", ['clock_offset_seconds' => -365 * 86400])
            ->assertOk()
            ->assertJsonPath('data.clock_offset_seconds', -31536000);

        $latest = $this->getJson('/api/glucose/readings')->assertOk()->json('data.0');
        $this->assertSame('2026-11-13T09:10:00', $latest['measured_at']);
        $this->assertSame('2027-11-13T09:10:00', $latest['device_measured_at']);

        // Novas importações já entram corrigidas e continuam deduplicando.
        $result = $this->withToken($token)->postJson('/api/glucose/import', $this->payload([
            ['device_measured_at' => '2027-11-13T09:10', 'value_mg_dl' => 150],
            ['device_measured_at' => '2027-11-14T09:10', 'value_mg_dl' => 140],
        ]))->assertOk()->json('data');
        $this->assertSame(1, $result['created']);
        $this->assertDatabaseHas('glucose_readings', ['value_mg_dl' => 140, 'measured_at' => '2026-11-14 09:10:00']);
    }

    public function test_clock_periods_fix_a_jump_in_the_device_clock(): void
    {
        // Cenário real: relógio 1 ano atrasado, depois pula 2 anos e fica 1 ano adiantado.
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant);
        $this->withToken($token)->postJson('/api/glucose/import', $this->payload([
            ['device_measured_at' => '2026-03-12T08:00', 'value_mg_dl' => 420], // depois do salto (mais recente primeiro)
            ['device_measured_at' => '2024-03-10T21:00', 'value_mg_dl' => 390],
            ['device_measured_at' => '2024-01-20T10:00', 'value_mg_dl' => 85],
        ]))->assertOk();

        $this->flushHeaders();
        Sanctum::actingAs($this->createAdmin($tenant));
        $id = $this->getJson('/api/glucose/devices')->json('data.0.id');

        $this->patchJson("/api/glucose/devices/{$id}", ['clock_offset_seconds' => 366 * 86400])->assertOk();
        $device = $this->patchJson("/api/glucose/devices/{$id}", [
            'split_at_device_time' => '2025-01-01T00:00',
            'split_offset_seconds' => -364 * 86400,
        ])->assertOk()->json('data');

        $this->assertCount(2, $device['clock_periods']);
        $this->assertSame(3, $device['clock_periods'][1]['from_sequence']);
        $this->assertSame(2, $device['clock_periods'][0]['readings_count']);

        $dates = collect($this->getJson('/api/glucose/readings')->json('data'))->pluck('measured_at', 'value_mg_dl');
        $this->assertSame('2025-01-20T10:00:00', $dates[85]);
        $this->assertSame('2025-03-11T21:00:00', $dates[390]); // 2024 é bissexto: o aparelho passou por 29/02
        $this->assertSame('2025-03-13T08:00:00', $dates[420]);
    }

    public function test_new_readings_follow_the_current_period_and_survive_a_clock_fix(): void
    {
        $tenant = $this->createTenantWithRoles();
        $token = $this->issueToken($tenant);
        $memory = [
            ['device_measured_at' => '2027-11-13T09:10', 'value_mg_dl' => 150],
            ['device_measured_at' => '2027-11-12T19:20', 'value_mg_dl' => 98],
        ];
        $this->withToken($token)->postJson('/api/glucose/import', $this->payload($memory))->assertOk();

        $this->flushHeaders();
        Sanctum::actingAs($this->createAdmin($tenant));
        $id = $this->getJson('/api/glucose/devices')->json('data.0.id');
        $this->patchJson("/api/glucose/devices/{$id}", ['clock_offset_seconds' => -364 * 86400])->assertOk();

        // Relógio acertado no aparelho: as próximas medições já vêm certas e voltam no tempo.
        $this->patchJson("/api/glucose/devices/{$id}", ['clock_fixed' => true])->assertOk()
            ->assertJsonCount(2, 'data.clock_periods');

        array_unshift($memory, ['device_measured_at' => '2026-11-15T08:00', 'value_mg_dl' => 120]);
        $this->withToken($token)->postJson('/api/glucose/import', $this->payload($memory))
            ->assertOk()->assertJsonPath('data.created', 1);

        $this->assertDatabaseHas('glucose_readings', ['value_mg_dl' => 120, 'device_sequence' => 3, 'measured_at' => '2026-11-15 08:00:00']);
        $this->assertDatabaseHas('glucose_readings', ['value_mg_dl' => 150, 'device_sequence' => 2, 'measured_at' => '2026-11-14 09:10:00']);
    }

    public function test_summary_statistics(): void
    {
        $tenant = $this->createTenantWithRoles();
        Sanctum::actingAs($this->createAdmin($tenant));

        foreach ([['2026-11-01 08:00', 50], ['2026-11-01 12:00', 65], ['2026-11-02 08:00', 100], ['2026-11-02 20:00', 200], ['2026-11-03 08:00', 300]] as [$at, $v]) {
            $this->postJson('/api/glucose/readings', ['measured_at' => $at, 'value_mg_dl' => $v])->assertCreated();
        }

        $s = $this->getJson('/api/glucose/summary?from=2026-11-01&to=2026-11-30')->assertOk()->json('data');

        $this->assertSame(5, $s['count']);
        $this->assertEquals(143.0, $s['mean']);
        $this->assertEquals(100.0, $s['median']);
        $this->assertSame(50, $s['min']);
        $this->assertSame(300, $s['max']);
        $this->assertEquals(6.7, $s['gmi']);
        $this->assertSame(1, $s['ranges']['very_low']['count']);
        $this->assertSame(1, $s['ranges']['low']['count']);
        $this->assertSame(1, $s['ranges']['in_range']['count']);
        $this->assertEquals(20.0, $s['ranges']['high']['percent']);
        $this->assertSame(1, $s['ranges']['very_high']['count']);
        $this->assertCount(3, $s['daily']);
        $this->assertCount(24, $s['hourly']);
        $this->assertEquals(150.0, collect($s['hourly'])->firstWhere('hour', 8)['mean']);
        $this->assertSame(300, $s['latest']['value_mg_dl']);
    }

    public function test_manual_reading_crud_and_filters(): void
    {
        $tenant = $this->createTenantWithRoles();
        Sanctum::actingAs($this->createAdmin($tenant));

        $id = $this->postJson('/api/glucose/readings', [
            'measured_at' => '2026-11-10 07:30',
            'value_mg_dl' => 250,
            'meal_tag' => 'before_meal',
        ])->assertCreated()->assertJsonPath('data.range', 'high')->json('data.id');

        $this->postJson('/api/glucose/readings', ['measured_at' => '2026-11-11 07:30', 'value_mg_dl' => 110])->assertCreated();

        $this->getJson('/api/glucose/readings?range=high')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/glucose/readings?meal_tag=before_meal')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/glucose/readings?from=2026-11-11')->assertOk()->assertJsonCount(1, 'data');

        $this->patchJson("/api/glucose/readings/{$id}", ['notes' => 'pós-pizza', 'meal_tag' => 'after_meal'])
            ->assertOk()
            ->assertJsonPath('data.notes', 'pós-pizza')
            ->assertJsonPath('data.meal_tag', 'after_meal');

        $this->deleteJson("/api/glucose/readings/{$id}")->assertOk();
        $this->getJson('/api/glucose/readings')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_readings_are_isolated_between_tenants(): void
    {
        $a = $this->createTenantWithRoles();
        $b = $this->createTenantWithRoles();

        $this->withToken($this->issueToken($a))
            ->postJson('/api/glucose/import', $this->payload($this->sampleReadings()))->assertOk();

        $this->flushHeaders();
        Sanctum::actingAs($this->createAdmin($b));
        $this->getJson('/api/glucose/readings')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/glucose/summary')->assertOk()->assertJsonPath('data.count', 0);

        $foreign = GlucoseReading::query()->withoutTenancy()->where('tenant_id', $a->id)->firstOrFail();
        $this->deleteJson("/api/glucose/readings/{$foreign->uuid}")->assertNotFound();
    }

    public function test_member_without_permission_cannot_read(): void
    {
        $tenant = $this->createTenantWithRoles();
        Sanctum::actingAs($this->createMember($tenant));

        $this->getJson('/api/glucose/readings')->assertForbidden();
    }
}
