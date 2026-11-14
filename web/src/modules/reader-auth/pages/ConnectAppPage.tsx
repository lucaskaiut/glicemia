import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { MonitorSmartphone, ShieldCheck } from 'lucide-react'
import { Alert, Button, Card, CardContent, Skeleton } from '@/shared/design-system'
import { http } from '@/shared/api/http'
import { isApiError } from '@/shared/api/errors'
import type { ApiResponse } from '@/shared/types/api'

const LOOPBACK = /^http:\/\/127\.0\.0\.1:\d{2,5}\/callback$/

/**
 * Tela de permissão do app desktop (OAuth para apps nativos, RFC 8252 + PKCE).
 * O app abre esta página no navegador; ao permitir, voltamos para o endereço local
 * do app (127.0.0.1) com um código de uso único.
 */
export default function ConnectAppPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const redirectUri = params.get('redirect_uri') ?? ''
  const state = params.get('state') ?? ''
  const challenge = params.get('code_challenge') ?? ''
  const method = params.get('code_challenge_method') ?? ''
  const deviceName = params.get('device_name')?.slice(0, 120) ?? null
  const validRequest = LOOPBACK.test(redirectUri) && /^[A-Za-z0-9_-]{43}$/.test(challenge) && method === 'S256' && state.length > 0
  const [leaving, setLeaving] = useState<'allowed' | 'denied' | null>(null)

  const account = useQuery({
    queryKey: ['reader-authorize'],
    queryFn: async () => (await http.get<ApiResponse<{ account: string }>>('/reader/authorize')).data.data,
    enabled: validRequest,
  })

  const back = (query: Record<string, string>) => {
    const url = new URL(redirectUri)
    Object.entries({ ...query, state }).forEach(([k, v]) => url.searchParams.set(k, v))
    window.location.assign(url.toString())
  }

  const allow = useMutation({
    mutationFn: async () =>
      (
        await http.post<ApiResponse<{ code: string }>>('/reader/authorize', {
          redirect_uri: redirectUri,
          code_challenge: challenge,
          code_challenge_method: method,
          device_name: deviceName,
        })
      ).data.data,
    onSuccess: ({ code }) => {
      setLeaving('allowed')
      back({ code })
    },
  })

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <span className="mb-8 font-display text-2xl font-medium text-foreground">Glicemia</span>
      <Card className="w-full max-w-md">
        <CardContent className="p-6 sm:p-8">
          {!validRequest ? (
            <Alert variant="danger" title="Link de conexão inválido">
              Abra o aplicativo Glicemia no computador e clique em “Conectar à minha conta” de novo.
            </Alert>
          ) : leaving ? (
            <div className="text-center">
              <h1 className="text-lg font-medium text-foreground">
                {leaving === 'allowed' ? 'Pronto! Voltando ao aplicativo…' : 'Conexão cancelada'}
              </h1>
              <p className="mt-2 text-sm text-muted">Você já pode fechar esta aba.</p>
            </div>
          ) : (
            <>
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <MonitorSmartphone className="size-5.5" aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-xl font-medium text-foreground">Conectar o aplicativo Glicemia</h1>
              {account.isPending ? (
                <Skeleton className="mt-3 h-5 w-3/4" />
              ) : (
                <p className="mt-2 text-sm text-muted">
                  O aplicativo{deviceName ? <> em <strong className="text-foreground">{deviceName}</strong></> : ' deste computador'} quer
                  enviar as medições do glicosímetro para a conta de{' '}
                  <strong className="text-foreground">{account.data?.account}</strong>.
                </p>
              )}

              <ul className="mt-5 grid gap-2 rounded-md bg-surface-2 p-4 text-[13px] text-muted">
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    Ele só poderá <strong className="text-foreground">enviar</strong> medições — não consegue ler os seus dados.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>Você pode desconectá-lo quando quiser em Ajustes → Tokens de API.</span>
                </li>
              </ul>

              {allow.isError && (
                <Alert variant="danger" className="mt-4" title={isApiError(allow.error) ? allow.error.message : 'Não foi possível autorizar.'} />
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLeaving('denied')
                    back({ error: 'access_denied' })
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={() => allow.mutate()} loading={allow.isPending} disabled={account.isPending}>
                  Permitir
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
