<?php

namespace App\Modules\Glucose\Http\Controllers;

use App\Modules\Glucose\Http\Requests\StoreGlucoseReadingRequest;
use App\Modules\Glucose\Http\Requests\UpdateGlucoseReadingRequest;
use App\Modules\Glucose\Http\Resources\GlucoseReadingResource;
use App\Modules\Glucose\Models\GlucoseReading;
use App\Modules\Glucose\Services\GlucoseReadingService;
use App\Modules\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlucoseReadingController extends ApiController
{
    public function __construct(private readonly GlucoseReadingService $service) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', GlucoseReading::class);

        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'range' => ['nullable', 'in:very_low,low,in_range,high,very_high'],
            'meal_tag' => ['nullable', 'in:none,before_meal,after_meal'],
        ]);

        $readings = $this->service->paginate(
            $request->only(['from', 'to', 'range', 'meal_tag']),
            (int) $request->integer('per_page', 25),
        );

        return $this->paginated(GlucoseReadingResource::collection($readings));
    }

    public function store(StoreGlucoseReadingRequest $request): JsonResponse
    {
        $this->authorize('create', GlucoseReading::class);

        $reading = $this->service->createManual($request->validated());

        return $this->created(GlucoseReadingResource::make($reading), 'Medição registrada.');
    }

    public function update(UpdateGlucoseReadingRequest $request, GlucoseReading $reading): JsonResponse
    {
        $this->authorize('update', $reading);

        $reading = $this->service->update($reading, $request->validated());

        return $this->success(GlucoseReadingResource::make($reading), 'Medição atualizada.');
    }

    public function destroy(GlucoseReading $reading): JsonResponse
    {
        $this->authorize('delete', $reading);

        $this->service->delete($reading);

        return $this->success(null, 'Medição removida.');
    }
}
