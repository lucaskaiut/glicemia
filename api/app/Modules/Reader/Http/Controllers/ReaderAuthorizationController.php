<?php

namespace App\Modules\Reader\Http\Controllers;

use App\Modules\Reader\Http\Requests\AuthorizeReaderRequest;
use App\Modules\Reader\Http\Requests\ExchangeReaderCodeRequest;
use App\Modules\Reader\Services\ReaderAuthorizationService;
use App\Modules\Shared\Http\Controllers\ApiController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReaderAuthorizationController extends ApiController
{
    public function __construct(private readonly ReaderAuthorizationService $service) {}

    /** Chamado pelo painel (sessão) quando a pessoa clica em "Permitir". */
    public function authorizeApp(AuthorizeReaderRequest $request): JsonResponse
    {
        $this->ensureSessionUser($request);
        $data = $request->validated();

        return $this->success($this->service->authorize(
            $request->user(),
            $data['redirect_uri'],
            $data['code_challenge'],
            $data['device_name'] ?? null,
        ));
    }

    /** Chamado pelo app desktop: troca o código + verificador PKCE por um token. */
    public function token(ExchangeReaderCodeRequest $request): JsonResponse
    {
        $data = $request->validated();

        return $this->success($this->service->exchange($data['code'], $data['code_verifier'], $data['redirect_uri']));
    }

    /** O que o painel mostra na tela de permissão. */
    public function preview(Request $request): JsonResponse
    {
        $this->ensureSessionUser($request);

        return $this->success(['account' => $request->user()->tenant?->name]);
    }

    /** Só uma pessoa logada no painel autoriza — nunca um token de API (evita um token gerar outros). */
    private function ensureSessionUser(Request $request): void
    {
        abort_if($request->attributes->get('api_token') !== null || $request->user() === null, 403, 'Entre no painel para autorizar o aplicativo.');
    }
}
