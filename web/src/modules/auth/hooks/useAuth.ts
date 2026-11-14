import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from '@/shared/stores/toast.store'
import { useSessionStore } from '@/shared/stores/session.store'
import { useTenantContextStore } from '@/shared/stores/tenant.store'
import { peekAfterLogin } from '@/shared/utils/after-login'
import { authService, sessionQueryOptions } from '../services/auth.service'

function useAuthenticate() {
  const queryClient = useQueryClient()
  const setSession = useSessionStore((state) => state.setSession)
  const navigate = useNavigate()

  return async () => {
    const session = await queryClient.fetchQuery(sessionQueryOptions)
    setSession(session)
    navigate(peekAfterLogin(), { replace: true })
  }
}

export function useLogin() {
  const authenticate = useAuthenticate()

  return useMutation({
    mutationFn: authService.login,
    onSuccess: async () => {
      await authenticate()
      toast.success('Login realizado', 'Bem-vindo de volta!')
    },
  })
}

export function useGoogleLogin() {
  const authenticate = useAuthenticate()

  return useMutation({
    mutationFn: authService.google,
    onSuccess: async () => {
      await authenticate()
      toast.success('Login realizado', 'Bem-vindo!')
    },
  })
}

export function useRegister() {
  const authenticate = useAuthenticate()

  return useMutation({
    mutationFn: authService.register,
    onSuccess: async () => {
      await authenticate()
      toast.success('Conta criada', 'Agora configure o leitor em Aparelhos.')
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const setGuest = useSessionStore((state) => state.setGuest)
  const clearSelectedTenantId = useTenantContextStore((state) => state.clearSelectedTenantId)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authService.logout,
    onSettled: () => {
      setGuest()
      clearSelectedTenantId()
      queryClient.clear()
      navigate('/auth/login', { replace: true })
    },
  })
}
