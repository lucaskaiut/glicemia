<?php

namespace App\Modules\Glucose\Http\Controllers;

use App\Modules\Glucose\Http\Requests\UpdateGlucoseDeviceRequest;
use App\Modules\Glucose\Http\Resources\GlucoseDeviceResource;
use App\Modules\Glucose\Models\GlucoseDevice;
use App\Modules\Glucose\Services\GlucoseImportService;
use App\Modules\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;

class GlucoseDeviceController extends ApiController
{
    public function __construct(private readonly GlucoseImportService $imports) {}

    public function index(): JsonResponse
    {
        $this->authorize('viewAny', GlucoseDevice::class);

        $devices = GlucoseDevice::query()->withCount('readings')->orderByDesc('last_synced_at')->get();

        return $this->success(GlucoseDeviceResource::collection($devices));
    }

    public function update(UpdateGlucoseDeviceRequest $request, GlucoseDevice $device): JsonResponse
    {
        $this->authorize('update', $device);

        $data = $request->validated();

        if (array_key_exists('name', $data)) {
            $device->forceFill(['name' => $data['name']])->save();
        }

        if (array_key_exists('clock_offsets', $data)) {
            $device = $this->imports->updateClockPeriods($device, $data['clock_offsets']);
        } elseif (array_key_exists('clock_offset_seconds', $data)) {
            $device = $this->imports->updateClockOffset($device, (int) $data['clock_offset_seconds']);
        }

        if (array_key_exists('split_at_device_time', $data)) {
            $device = $this->imports->splitAtDeviceTime($device, $data['split_at_device_time'], (int) $data['split_offset_seconds']);
        }

        if (! empty($data['clock_fixed'])) {
            $device = $this->imports->markClockFixed($device);
        }

        return $this->success(
            GlucoseDeviceResource::make($device->loadCount('readings')),
            'Aparelho atualizado.',
        );
    }
}
