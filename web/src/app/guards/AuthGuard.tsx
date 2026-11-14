import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessionStore } from '@/shared/stores/session.store'
import { FullScreenLoading } from '@/shared/design-system'
import { clearAfterLogin, rememberAfterLogin } from '@/shared/utils/after-login'

/**
 * Permite acesso apenas a usuários autenticados.
 */
export function AuthGuard() {
  const status = useSessionStore((state) => state.status)
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoading />

  if (status === 'guest') {
    // Guarda o destino completo (com a query) para voltar após login, cadastro ou Google.
    rememberAfterLogin(location.pathname + location.search)
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  }

  clearAfterLogin()
  return <Outlet />
}
