import { Suspense, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ChevronDown,
  KeyRound,
  ListOrdered,
  LogOut,
  Menu,
  ScrollText,
  Settings2,
  Smartphone,
  Webhook,
  X,
} from 'lucide-react'
import { useLogout } from '@/modules/auth/hooks/useAuth'
import { Permission } from '@/shared/constants/permissions'
import { usePermissions } from '@/shared/hooks/usePermissions'
import { useSessionStore } from '@/shared/stores/session.store'
import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownSeparator,
  Loading,
  ThemeToggle,
} from '@/shared/design-system'
import { cn } from '@/shared/utils/cn'

interface NavEntry {
  to: string
  label: string
  icon: LucideIcon
  permission?: Permission
  end?: boolean
}

const PRIMARY_NAV: NavEntry[] = [
  { to: '/', label: 'Panorama', icon: Activity, permission: Permission.GLUCOSE_READ, end: true },
  { to: '/medicoes', label: 'Medições', icon: ListOrdered, permission: Permission.GLUCOSE_READ },
  { to: '/aparelhos', label: 'Aparelhos', icon: Smartphone, permission: Permission.GLUCOSE_READ },
]

const SETTINGS_NAV: NavEntry[] = [
  { to: '/api-tokens', label: 'Tokens de API', icon: KeyRound, permission: Permission.API_TOKEN_READ },
  { to: '/webhooks', label: 'Webhooks', icon: Webhook, permission: Permission.WEBHOOK_READ },
  { to: '/audit', label: 'Auditoria', icon: ScrollText, permission: Permission.AUDIT_VIEW },
]

function Wordmark() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5" aria-label="Glicemia — início">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="6" className="fill-primary" />
        <path d="M16 6c-4.5 6-7 9.6-7 13a7 7 0 0 0 14 0c0-3.4-2.5-7-7-13z" className="fill-background" />
        <path d="M12.5 19.5h7" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[1.35rem] leading-none font-medium tracking-tight text-foreground">
        Glicemia
      </span>
    </NavLink>
  )
}

function TopNavLink({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex h-full items-center gap-2 px-1 text-sm font-medium transition-colors',
          'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:transition-colors',
          isActive
            ? 'text-foreground after:bg-accent'
            : 'text-muted after:bg-transparent hover:text-foreground',
        )
      }
    >
      <entry.icon className="size-4" aria-hidden="true" />
      {entry.label}
    </NavLink>
  )
}

function SettingsMenu({ entries }: { entries: NavEntry[] }) {
  const navigate = useNavigate()

  if (entries.length === 0) return null

  return (
    <Dropdown
      label="Ajustes"
      trigger={
        <span className="flex h-9 items-center gap-1.5 px-1 text-sm font-medium text-muted transition-colors hover:text-foreground">
          <Settings2 className="size-4" aria-hidden="true" />
          Ajustes
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </span>
      }
    >
      {entries.map((entry) => (
        <DropdownItem key={entry.to} icon={entry.icon} onSelect={() => navigate(entry.to)}>
          {entry.label}
        </DropdownItem>
      ))}
    </Dropdown>
  )
}

function UserMenu() {
  const user = useSessionStore((state) => state.user)
  const logout = useLogout()

  if (!user) return null

  return (
    <Dropdown
      label="Menu do usuário"
      trigger={
        <span className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-2">
          <Avatar name={user.name} size="sm" />
          <span className="hidden max-w-32 truncate text-[13px] font-medium text-foreground md:block">
            {user.name.split(' ')[0]}
          </span>
        </span>
      }
    >
      <div className="px-3 py-2">
        <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>
      <DropdownSeparator />
      <DropdownItem icon={LogOut} danger onSelect={() => logout.mutate()}>
        Sair da conta
      </DropdownItem>
    </Dropdown>
  )
}

export function AppLayout() {
  const { can } = usePermissions()
  const [mobileOpen, setMobileOpen] = useState(false)

  const allowed = (entry: NavEntry) => !entry.permission || can(entry.permission)
  const primary = PRIMARY_NAV.filter(allowed)
  const settings = SETTINGS_NAV.filter(allowed)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 md:gap-8">
          <Wordmark />

          <nav className="hidden h-full items-stretch gap-6 md:flex" aria-label="Menu principal">
            {primary.map((entry) => (
              <TopNavLink key={entry.to} entry={entry} />
            ))}
            <div className="flex items-center">
              <SettingsMenu entries={settings} />
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu />
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileOpen}
              className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground md:hidden"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            className="animate-fade-in border-t border-border px-4 py-3 md:hidden"
            aria-label="Menu principal"
          >
            <ul className="flex flex-col">
              {[...primary, ...settings].map((entry) => (
                <li key={entry.to}>
                  <NavLink
                    to={entry.to}
                    end={entry.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex h-11 items-center gap-3 border-l-2 pl-3 text-sm',
                        isActive
                          ? 'border-accent font-medium text-foreground'
                          : 'border-transparent text-muted',
                      )
                    }
                  >
                    <entry.icon className="size-4" aria-hidden="true" />
                    {entry.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
