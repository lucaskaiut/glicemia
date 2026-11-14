<?php

namespace App\Modules\Glucose\Policies;

use App\Modules\ACL\Enums\Permission;
use App\Modules\Glucose\Models\GlucoseDevice;
use App\Modules\Tenant\Support\TenantAuthorization;
use App\Modules\User\Models\User;

class GlucoseDevicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::GLUCOSE_READ);
    }

    public function update(User $user, GlucoseDevice $device): bool
    {
        return TenantAuthorization::matchesCurrentTenant((int) $device->tenant_id)
            && $user->hasPermission(Permission::GLUCOSE_DEVICE_MANAGE);
    }
}
