<?php

namespace App\Modules\Glucose\Http\Controllers;

use App\Modules\Glucose\Http\Requests\ImportGlucoseReadingsRequest;
use App\Modules\Glucose\Http\Resources\GlucoseDeviceResource;
use App\Modules\Glucose\Models\GlucoseReading;
use App\Modules\Glucose\Services\GlucoseImportService;
use App\Modules\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;

class GlucoseImportController extends ApiController
{
    public function __construct(private readonly GlucoseImportService $service) {}

    public function __invoke(ImportGlucoseReadingsRequest $request): JsonResponse
    {
        $this->authorize('import', GlucoseReading::class);

        $result = $this->service->import(
            $request->validated('device'),
            $request->validated('readings'),
        );

        return $this->success([
            'device' => GlucoseDeviceResource::make($result['device']),
            'received' => $result['received'],
            'created' => $result['created'],
            'duplicates' => $result['duplicates'],
        ], "{$result['created']} nova(s) medição(ões) importada(s).");
    }
}
