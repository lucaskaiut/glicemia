import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Modal } from '@/shared/design-system'
import { isApiError } from '@/shared/api/errors'
import { resolveTheme, useThemeStore } from '@/shared/stores/theme.store'
import { authService } from '../services/auth.service'
import { useGoogleLogin } from '../hooks/useAuth'

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; context?: string }) => void
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Não foi possível carregar o login do Google.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Botão "Continuar com o Google". Só aparece quando a API informa um Client ID.
 * Se ainda não houver conta com o e-mail, pede o aceite do uso dos dados antes de criar.
 */
export function GoogleSignIn({ context = 'signin' }: { context?: 'signin' | 'signup' }) {
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authService.providers, staleTime: Infinity, retry: 1 })
  const clientId = providers.data?.google_client_id ?? null
  const google = useGoogleLogin()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const theme = resolveTheme(useThemeStore((state) => state.theme))

  const submit = (credential: string, acceptTerms = false) => {
    google.mutate(
      { credential, accept_terms: acceptTerms },
      {
        onError: (error) => {
          if (isApiError(error) && error.status === 422 && error.fieldErrors.accept_terms) setPending(credential)
        },
        onSuccess: () => setPending(null),
      },
    )
  }

  // O Google guarda o callback de initialize(); a ref garante que ele chame o submit mais recente.
  const submitRef = useRef(submit)
  useEffect(() => {
    submitRef.current = submit
  })

  useEffect(() => {
    if (!clientId || !buttonRef.current) return
    let cancelled = false
    loadScript()
      .then(() => {
        const el = buttonRef.current
        if (cancelled || !el || !window.google) return
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => submitRef.current(r.credential), ux_mode: 'popup', context })
        window.google.accounts.id.renderButton(el, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: context === 'signup' ? 'signup_with' : 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(400, el.clientWidth || 300),
          locale: 'pt-BR',
        })
      })
      .catch((error: Error) => !cancelled && setLoadError(error.message))
    return () => {
      cancelled = true
    }
  }, [clientId, theme, context])

  if (!clientId) return null

  const error = google.isError && isApiError(google.error) && !google.error.fieldErrors.accept_terms ? google.error : null

  return (
    <div className="grid gap-4">
      <div ref={buttonRef} className="flex min-h-10 w-full justify-center" aria-busy={google.isPending} />
      {(error || loadError) && (
        <Alert variant="danger" title={loadError ?? error?.fieldErrors.credential?.[0] ?? error?.message ?? ''} />
      )}
      <div className="flex items-center gap-3 text-xs text-subtle">
        <span className="h-px flex-1 bg-border" />
        ou com e-mail
        <span className="h-px flex-1 bg-border" />
      </div>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title="Criar sua conta com o Google"
        description="Ainda não existe uma conta do Glicemia com este e-mail."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button loading={google.isPending} onClick={() => pending && submit(pending, true)}>
              Concordo e criar conta
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Ao continuar, você concorda em guardar suas medições de glicose nesta conta. São dados de saúde: só você tem
          acesso a eles e pode apagá-los quando quiser.
        </p>
      </Modal>
    </div>
  )
}
