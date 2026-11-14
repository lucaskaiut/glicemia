import { queryOptions } from '@tanstack/react-query'
import { http } from '@/shared/api/http'
import { ensureCsrfCookie } from '@/shared/api/csrf'
import { queryKeys } from '@/shared/constants/query-keys'
import type { ApiResponse } from '@/shared/types/api'
import type { AvailableTenant, Session } from '@/shared/types/models'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
  accept_terms: boolean
}

export interface AuthProviders {
  google_client_id: string | null
}

export const authService = {
  async providers(): Promise<AuthProviders> {
    const response = await http.get<ApiResponse<AuthProviders>>('/auth/providers')

    return response.data.data
  },

  async google(payload: { credential: string; accept_terms?: boolean }): Promise<void> {
    await ensureCsrfCookie()
    await http.post('/auth/google', payload)
  },

  async login(payload: LoginPayload): Promise<void> {
    await ensureCsrfCookie()
    await http.post('/auth/login', payload)
  },

  async register(payload: RegisterPayload): Promise<void> {
    await ensureCsrfCookie()
    await http.post('/auth/register', payload)
  },

  async logout(): Promise<void> {
    await http.post('/auth/logout')
  },

  async me(): Promise<Session> {
    const response = await http.get<ApiResponse<Session>>('/auth/me')

    return response.data.data
  },

  async selectTenant(tenantId: string): Promise<AvailableTenant> {
    const response = await http.post<ApiResponse<{ tenant: AvailableTenant }>>(
      '/auth/select-tenant',
      { tenant_id: tenantId },
    )

    return response.data.data.tenant
  },
}

export const sessionQueryOptions = queryOptions({
  queryKey: queryKeys.session,
  queryFn: authService.me,
  retry: false,
  staleTime: 5 * 60 * 1000,
})
