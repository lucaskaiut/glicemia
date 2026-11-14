<?php

use App\Modules\ACL\Http\Controllers\RoleController;
use App\Modules\ApiToken\Http\Controllers\ApiTokenController;
use App\Modules\Assistant\Http\Controllers\ChatController;
use App\Modules\Assistant\Http\Controllers\ConversationController;
use App\Modules\Audit\Http\Controllers\AuditLogController;
use App\Modules\Auth\Http\Controllers\AuthController;
use App\Modules\Glucose\Http\Controllers\GlucoseDeviceController;
use App\Modules\Glucose\Http\Controllers\GlucoseImportController;
use App\Modules\Glucose\Http\Controllers\GlucoseReaderController;
use App\Modules\Glucose\Http\Controllers\GlucoseReadingController;
use App\Modules\Glucose\Http\Controllers\GlucoseSummaryController;
use App\Modules\Reader\Http\Controllers\ReaderAuthorizationController;
use App\Modules\Shared\Http\Controllers\FileUploadController;
use App\Modules\Tenant\Http\Controllers\TenantController;
use App\Modules\User\Http\Controllers\UserController;
use App\Modules\Webhook\Http\Controllers\WebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:auth');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:auth');
    Route::post('google', [AuthController::class, 'google'])->middleware('throttle:auth');
    Route::get('providers', [AuthController::class, 'providers']);

    Route::middleware(['auth:sanctum', 'tenant'])->group(function (): void {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
        Route::post('select-tenant', [AuthController::class, 'selectTenant']);
    });
});

// App desktop: troca do código de autorização (PKCE) por token — público, com limite.
Route::post('reader/token', [ReaderAuthorizationController::class, 'token'])->middleware('throttle:auth');

/*
 * Glicemia: cadastro gratuito, contas independentes. As rotas de billing (planos,
 * assinatura, cobranças) e de contas filhas do skeleton não são expostas.
 */
Route::middleware(['auth.multi:sanctum', 'tenant', 'subscription.active'])->group(function (): void {
    Route::get('tenant', [TenantController::class, 'show'])->middleware('permission:tenant.read');
    Route::match(['put', 'patch'], 'tenant', [TenantController::class, 'update'])->middleware('permission:tenant.update');

    Route::get('users', [UserController::class, 'index'])->middleware('permission:user.read');
    Route::get('users/{user}', [UserController::class, 'show'])->middleware('permission:user.read');
    Route::match(['put', 'patch'], 'users/{user}', [UserController::class, 'update'])->middleware('permission:user.update');
    Route::delete('users/{user}', [UserController::class, 'destroy'])->middleware('permission:user.delete');

    Route::get('roles', [RoleController::class, 'index'])->middleware('permission:role.read');
    Route::post('roles', [RoleController::class, 'store'])->middleware('permission:role.create');
    Route::get('roles/{role}', [RoleController::class, 'show'])->middleware('permission:role.read');
    Route::match(['put', 'patch'], 'roles/{role}', [RoleController::class, 'update'])->middleware('permission:role.update');
    Route::delete('roles/{role}', [RoleController::class, 'destroy'])->middleware('permission:role.delete');

    Route::get('api-tokens', [ApiTokenController::class, 'index'])->middleware('permission:api-token.read');
    Route::post('api-tokens', [ApiTokenController::class, 'store'])->middleware('permission:api-token.create');
    Route::match(['put', 'patch'], 'api-tokens/{apiToken}', [ApiTokenController::class, 'update'])->middleware('permission:api-token.update');
    Route::delete('api-tokens/{apiToken}', [ApiTokenController::class, 'destroy'])->middleware('permission:api-token.delete');

    Route::get('webhooks', [WebhookController::class, 'index'])->middleware('permission:webhook.read');
    Route::get('webhooks/events', [WebhookController::class, 'events'])->middleware('permission:webhook.read');
    Route::post('webhooks', [WebhookController::class, 'store'])->middleware('permission:webhook.create');
    Route::get('webhooks/{webhook}', [WebhookController::class, 'show'])->middleware('permission:webhook.read');
    Route::match(['put', 'patch'], 'webhooks/{webhook}', [WebhookController::class, 'update'])->middleware('permission:webhook.update');
    Route::delete('webhooks/{webhook}', [WebhookController::class, 'destroy'])->middleware('permission:webhook.delete');
    Route::get('webhooks/{webhook}/logs', [WebhookController::class, 'logs'])->middleware('permission:webhook.read');

    Route::get('audit', [AuditLogController::class, 'index'])->middleware('permission:audit.view');

    Route::post('uploads', FileUploadController::class);

    // Glicemia
    Route::get('reader/authorize', [ReaderAuthorizationController::class, 'preview'])->middleware('permission:glucose.import');
    Route::post('reader/authorize', [ReaderAuthorizationController::class, 'authorizeApp'])->middleware('permission:glucose.import');
    Route::post('glucose/import', GlucoseImportController::class)->middleware('permission:glucose.import');
    Route::get('glucose/reader/whoami', [GlucoseReaderController::class, 'whoami'])->middleware('permission:glucose.import');
    Route::get('glucose/summary', GlucoseSummaryController::class)->middleware('permission:glucose.read');
    Route::get('glucose/readings', [GlucoseReadingController::class, 'index'])->middleware('permission:glucose.read');
    Route::post('glucose/readings', [GlucoseReadingController::class, 'store'])->middleware('permission:glucose.create');
    Route::match(['put', 'patch'], 'glucose/readings/{reading}', [GlucoseReadingController::class, 'update'])->middleware('permission:glucose.update');
    Route::delete('glucose/readings/{reading}', [GlucoseReadingController::class, 'destroy'])->middleware('permission:glucose.delete');
    Route::get('glucose/devices', [GlucoseDeviceController::class, 'index'])->middleware('permission:glucose.read');
    Route::match(['put', 'patch'], 'glucose/devices/{device}', [GlucoseDeviceController::class, 'update'])->middleware('permission:glucose.device.manage');

    // Assistente de IA
    Route::get('assistant/conversations', [ConversationController::class, 'index'])->middleware('permission:assistant.view');
    Route::post('assistant/conversations', [ConversationController::class, 'store'])->middleware('permission:assistant.view');
    Route::get('assistant/conversations/{conversation}', [ConversationController::class, 'show'])->middleware('permission:assistant.view');
    Route::match(['put', 'patch'], 'assistant/conversations/{conversation}', [ConversationController::class, 'update'])->middleware('permission:assistant.view');
    Route::delete('assistant/conversations/{conversation}', [ConversationController::class, 'destroy'])->middleware('permission:assistant.view');
    Route::post('assistant/conversations/{conversation}/messages', [ChatController::class, 'send'])->middleware('permission:assistant.view');
});
