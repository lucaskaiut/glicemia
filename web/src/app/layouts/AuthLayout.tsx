import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { Loading, ThemeToggle } from '@/shared/design-system'

/** Faixa decorativa com as cinco cores de faixa glicêmica, de baixo para alto. */
function RangeStripe() {
  return (
    <div className="flex h-1.5 w-full gap-0.5" aria-hidden="true">
      <span className="w-[4%] bg-range-very-low" />
      <span className="w-[6%] bg-range-low" />
      <span className="flex-1 bg-range-in" />
      <span className="w-[18%] bg-range-high" />
      <span className="w-[8%] bg-range-very-high" />
    </div>
  )
}

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <RangeStripe />
      <div className="relative grid flex-1 lg:grid-cols-[1.1fr_1fr]">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <aside className="hidden flex-col justify-between border-r border-border px-12 py-14 lg:flex">
          <span className="font-display text-2xl font-medium text-foreground">Glicemia</span>
          <div className="max-w-md">
            <p className="font-display text-[2.6rem] leading-[1.1] font-normal text-foreground">
              Suas medições, <em className="text-accent">sem digitar nada</em>.
            </p>
            <p className="mt-5 text-[15px] leading-relaxed text-muted">
              Conecte o glicosímetro ao computador e as leituras chegam aqui sozinhas — com
              médias, tempo no alvo e o perfil do seu dia.
            </p>
          </div>
          <p className="text-xs text-subtle">© {new Date().getFullYear()} Glicemia</p>
        </aside>

        <div className="flex flex-col items-center justify-center px-4 py-12">
          <span className="mb-8 font-display text-2xl font-medium text-foreground lg:hidden">
            Glicemia
          </span>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
