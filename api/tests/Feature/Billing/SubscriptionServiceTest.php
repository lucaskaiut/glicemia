<?php

namespace Tests\Feature\Billing;

use App\Modules\Billing\Enums\SubscriptionStatus;
use App\Modules\Billing\Models\Plan;
use App\Modules\Billing\Services\SubscriptionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenants;
use Tests\TestCase;

class SubscriptionServiceTest extends TestCase
{
    use InteractsWithTenants;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['billing.active' => ['mockPix', 'asaasCreditCard']]);
    }

    public function test_create_subscription_with_trial_sets_trialing_and_next_billing(): void
    {
        Carbon::setTestNow('2026-07-01 12:00:00');

        $umbrella = $this->createTenantWithRoles();
        $child = $this->createChildTenant($umbrella);
        $plan = Plan::factory()->forTenant($umbrella)->create([
            'free_trial_days' => 7,
            'price' => '49.90',
        ]);

        $subscription = app(SubscriptionService::class)->createForTenant($child, $plan, 'mockPix');

        $this->assertSame(SubscriptionStatus::TRIALING, $subscription->status);
        $this->assertSame('2026-07-08 12:00:00', $subscription->next_billing_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-07-08 12:00:00', $subscription->trial_ends_at->format('Y-m-d H:i:s'));
        $this->assertDatabaseHas('subscription_events', [
            'subscription_id' => $subscription->getKey(),
            'event' => 'TRIAL_STARTED',
        ]);
    }

    public function test_create_subscription_without_trial_bills_immediately(): void
    {
        Carbon::setTestNow('2026-07-01 12:00:00');

        $umbrella = $this->createTenantWithRoles();
        $child = $this->createChildTenant($umbrella);
        $plan = Plan::factory()->forTenant($umbrella)->withoutTrial()->create();

        $subscription = app(SubscriptionService::class)->createForTenant($child, $plan, 'mockPix');

        $this->assertSame(SubscriptionStatus::ACTIVE, $subscription->status);
        $this->assertSame('2026-07-01 12:00:00', $subscription->next_billing_at->format('Y-m-d H:i:s'));
        $this->assertNull($subscription->trial_ends_at);
    }

    public function test_confirm_payment_advances_next_billing_by_recurrence(): void
    {
        Carbon::setTestNow('2026-01-01 10:00:00');

        $umbrella = $this->createTenantWithRoles();
        $child = $this->createChildTenant($umbrella);
        $plan = Plan::factory()->forTenant($umbrella)->withoutTrial()->create([
            'recurrence_value' => 30,
        ]);

        $service = app(SubscriptionService::class);
        $subscription = $service->createForTenant($child, $plan, 'mockPix');

        Carbon::setTestNow('2026-01-01 11:00:00');
        $updated = $service->confirmPayment($subscription);

        $this->assertSame(SubscriptionStatus::ACTIVE, $updated->status);
        $this->assertSame('2026-01-01 11:00:00', $updated->last_billed_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-01-31 11:00:00', $updated->next_billing_at->format('Y-m-d H:i:s'));
    }
}
