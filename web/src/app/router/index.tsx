import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AuthGuard } from '@/app/guards/AuthGuard'
import { GuestGuard } from '@/app/guards/GuestGuard'
import { PermissionGuard } from '@/app/guards/PermissionGuard'
import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { Permission } from '@/shared/constants/permissions'
import { FullScreenLoading } from '@/shared/design-system'
import { NotFoundPage } from './NotFoundPage'

const LoginPage = lazy(() => import('@/modules/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/modules/auth/pages/RegisterPage'))
const ConnectAppPage = lazy(() => import('@/modules/reader-auth/pages/ConnectAppPage'))
const OverviewPage = lazy(() => import('@/modules/glucose/pages/OverviewPage'))
const ReadingsPage = lazy(() => import('@/modules/glucose/pages/ReadingsPage'))
const DevicesPage = lazy(() => import('@/modules/glucose/pages/DevicesPage'))
const UsersListPage = lazy(() => import('@/modules/users/pages/UsersListPage'))
const UserEditPage = lazy(() => import('@/modules/users/pages/UserEditPage'))
const ApiTokensListPage = lazy(() => import('@/modules/api-tokens/pages/ApiTokensListPage'))
const ApiTokenCreatePage = lazy(() => import('@/modules/api-tokens/pages/ApiTokenCreatePage'))
const WebhooksListPage = lazy(() => import('@/modules/webhooks/pages/WebhooksListPage'))
const WebhookCreatePage = lazy(() => import('@/modules/webhooks/pages/WebhookCreatePage'))
const WebhookEditPage = lazy(() => import('@/modules/webhooks/pages/WebhookEditPage'))
const AuditPage = lazy(() => import('@/modules/audit/pages/AuditPage'))
const AssistantPage = lazy(() => import('@/modules/assistant/pages/AssistantPage'))

export const router = createBrowserRouter([
  {
    element: <GuestGuard />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/auth/login', element: <LoginPage /> },
          { path: '/auth/register', element: <RegisterPage /> },
        ],
      },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      {
        path: '/conectar-app',
        element: (
          <Suspense fallback={<FullScreenLoading />}>
            <ConnectAppPage />
          </Suspense>
        ),
      },
      {
        element: <AppLayout />,
        children: [
          {
            path: '/',
            element: (
              <PermissionGuard permission={Permission.GLUCOSE_READ}>
                <OverviewPage />
              </PermissionGuard>
            ),
          },
          { path: '/dashboard', element: <Navigate to="/" replace /> },
          {
            path: '/medicoes',
            element: (
              <PermissionGuard permission={Permission.GLUCOSE_READ}>
                <ReadingsPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/aparelhos',
            element: (
              <PermissionGuard permission={Permission.GLUCOSE_READ}>
                <DevicesPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/users',
            element: (
              <PermissionGuard permission={Permission.USER_READ}>
                <UsersListPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/users/:id/edit',
            element: (
              <PermissionGuard permission={Permission.USER_UPDATE}>
                <UserEditPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/api-tokens',
            element: (
              <PermissionGuard permission={Permission.API_TOKEN_READ}>
                <ApiTokensListPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/api-tokens/create',
            element: (
              <PermissionGuard permission={Permission.API_TOKEN_CREATE}>
                <ApiTokenCreatePage />
              </PermissionGuard>
            ),
          },
          {
            path: '/webhooks',
            element: (
              <PermissionGuard permission={Permission.WEBHOOK_READ}>
                <WebhooksListPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/webhooks/create',
            element: (
              <PermissionGuard permission={Permission.WEBHOOK_CREATE}>
                <WebhookCreatePage />
              </PermissionGuard>
            ),
          },
          {
            path: '/webhooks/:id/edit',
            element: (
              <PermissionGuard permission={Permission.WEBHOOK_UPDATE}>
                <WebhookEditPage />
              </PermissionGuard>
            ),
          },
          {
            path: '/audit',
            element: (
              <PermissionGuard permission={Permission.AUDIT_VIEW}>
                <AuditPage />
              </PermissionGuard>
            ),
          },
        ],
      },
      {
        path: '/assistant/:id?',
        element: (
          <PermissionGuard permission={Permission.ASSISTANT_VIEW}>
            <AssistantPage />
          </PermissionGuard>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
