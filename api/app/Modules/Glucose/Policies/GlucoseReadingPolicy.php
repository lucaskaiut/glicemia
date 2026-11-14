<?php

namespace App\Modules\Glucose\Policies;

use App\Modules\ACL\Enums\Permission;
use App\Modules\Glucose\Models\GlucoseReading;
use App\Modules\Tenant\Support\TenantAuthorization;
use App\Modules\User\Models\User;

class GlucoseReadingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::GLUCOSE_READ);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::GLUCOSE_CREATE);
    }

    public function update(User $user, GlucoseReading $reading): bool
    {
        return $this->sameTenant($reading) && $user->hasPermission(Permission::GLUCOSE_UPDATE);
    }

    public function delete(User $user, GlucoseReading $reading): bool
    {
        return $this->sameTenant($reading) && $user->hasPermission(Permission::GLUCOSE_DELETE);
    }

    public function import(User $user): bool
    {
        return $user->hasPermission(Permission::GLUCOSE_IMPORT);
    }

    private function sameTenant(GlucoseReading $reading): bool
    {
        return TenantAuthorization::matchesCurrentTenant((int) $reading->tenant_id);
    }
}
