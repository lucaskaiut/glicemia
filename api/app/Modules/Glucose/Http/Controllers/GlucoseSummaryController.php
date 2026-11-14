<?php

namespace App\Modules\Glucose\Http\Controllers;

use App\Modules\Glucose\Models\GlucoseReading;
use App\Modules\Glucose\Services\GlucoseSummaryService;
use App\Modules\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlucoseSummaryController extends ApiController
{
    public function __construct(private readonly GlucoseSummaryService $service) {}

    public function __invoke(Request $request): JsonResponse
    {
        $this->authorize('viewAny', GlucoseReading::class);

        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        return $this->success($this->service->summarize(
            $request->string('from')->toString() ?: null,
            $request->string('to')->toString() ?: null,
        ));
    }
}
