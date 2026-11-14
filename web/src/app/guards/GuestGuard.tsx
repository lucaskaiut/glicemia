import { Navigate, Outlet } from 'react-router'
import { useSessionStore } from '@/shared/stores/session.store'
import { FullScreenLoading } from '@/shared/design-system'
import { peekAfterLogin } from '@/shared/utils/after-login'

/**
 * Permite acesso apenas a visitantes (não autenticados).
 */
export function GuestGuard() {
  const status = useSessionStore((state) => state.status)

  if (status === 'loading') return <FullScreenLoading />

  if (status === 'authenticated') return <Navigate to={peekAfterLogin()} replace />

  return <Outlet />
}
