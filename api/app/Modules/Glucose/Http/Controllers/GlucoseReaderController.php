<?php

namespace App\Modules\Glucose\Http\Controllers;

use App\Modules\Glucose\Models\GlucoseDevice;
use App\Modules\Shared\Http\Controllers\ApiController;
use App\Modules\Tenant\Models\Tenant;
use App\Modules\Tenant\Support\Facades\TenantContext;
use Illuminate\Http\JsonResponse;

/**
 * Usado pelo leitor (glicemia-leitor.exe) ao ser vinculado: confirma a qual conta
 * pertence o código colado, sem expor nenhuma medição.
 */
class GlucoseReaderController extends ApiController
{
    public function whoami(): JsonResponse
    {
        /** @var Tenant $tenant */
        $tenant = TenantContext::tenant();
        $device = GlucoseDevice::query()->first();

        return $this->success([
            'account' => $tenant->name,
            'device' => $device ? ['model' => $device->model, 'name' => $device->name, 'last_synced_at' => $device->last_synced_at?->toIso8601String()] : null,
        ]);
    }
}
