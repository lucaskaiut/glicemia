import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { PlugZap } from 'lucide-react'
import {
  Alert,
  ButtonLink,
  Card,
  EmptyState,
  Page,
  PageHeader,
  SegmentedControl,
  Skeleton,
} from '@/shared/design-system'
import { cn } from '@/shared/utils/cn'
import { DailyChart } from '../components/DailyChart'
import { HourlyProfile } from '../components/HourlyProfile'
import { RangeBadge } from '../components/RangeBadge'
import { TimeInRange } from '../components/TimeInRange'
import { useGlucoseSummary } from '../hooks/useGlucose'
import { RANGE_META, fmt, isoDate, parseLocal, relativeTime } from '../utils/glucose'

type Period = '7' | '14' | '30' | '90' | 'all'

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
  { value: '90', label: '90d' },
  { value: 'all', label: 'Tudo' },
]

function periodParams(period: Period): { from?: string; to?: string } {
  if (period === 'all') return {}
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - Number(period) + 1)
  return { from: isoDate(from), to: isoDate(to) }
}

function Panel({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  )
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="border-t border-border pt-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-[2rem] leading-none text-foreground">
        {value}
        {unit && <span className="ml-1 font-sans text-sm text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
    </div>
  )
}

export default function OverviewPage() {
  const [period, setPeriod] = useState<Period>('14')
  const params = useMemo(() => periodParams(period), [period])
  const query = useGlucoseSummary(params)
  const s = query.data

  const clockAhead = s?.latest && parseLocal(s.latest.measured_at).getTime() > Date.now() + 60 * 60 * 1000
  const days = s?.daily.length ?? 0

  return (
    <Page>
      <PageHeader
        title="Panorama"
        description={
          s?.period.first_at && s.period.last_at
            ? `${fmt.dayMonth(s.period.first_at)} a ${fmt.dayMonth(s.period.last_at)} · ${s.count} medições`
            : 'Resumo das suas medições'
        }
        actions={
          <SegmentedControl value={period} options={PERIODS} onChange={setPeriod} className="w-[20rem] max-w-full" />
        }
      />

      {clockAhead && (
        <Alert variant="warning" title="O relógio do glicosímetro parece adiantado">
          A medição mais recente está marcada para {fmt.full(s!.latest!.measured_at)}, no futuro. Ajuste o relógio em{' '}
          <Link to="/aparelhos" className="font-semibold underline underline-offset-2">
            Aparelhos
          </Link>{' '}
          para que os períodos fiquem corretos.
        </Alert>
      )}

      {query.isPending ? (
        <div className="grid gap-5">
          <Skeleton className="h-44" />
          <Skeleton className="h-72" />
        </div>
      ) : !s?.latest ? (
        <Card>
          <EmptyState
            icon={PlugZap}
            title="Nenhuma medição ainda"
            description="Instale o leitor no computador e conecte o glicosímetro pelo cabo USB — as medições aparecem aqui automaticamente."
            action={<ButtonLink to="/aparelhos">Configurar o leitor</ButtonLink>}
          />
        </Card>
      ) : (
        <>
          <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="relative overflow-hidden rounded-xl bg-surface p-6 shadow-card">
              <span className={cn('absolute inset-y-0 left-0 w-1', RANGE_META[s.latest.range].bg)} aria-hidden="true" />
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Última medição</p>
              <p className="mt-3 font-display text-[4.5rem] leading-none font-normal text-foreground">
                {s.latest.value_mg_dl}
                <span className="ml-2 font-sans text-base text-muted">mg/dL</span>
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                <RangeBadge range={s.latest.range} />
                <span className="text-xs text-subtle" title={fmt.full(s.latest.measured_at)}>
                  {fmt.full(s.latest.measured_at)} · {relativeTime(s.latest.measured_at)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-6 self-center">
              <Stat label="Média" value={fmt.number(s.mean)} unit="mg/dL" hint={`Mediana ${fmt.number(s.median)} · ${fmt.number(s.min)}–${fmt.number(s.max)}`} />
              <Stat label="A1c estimada (GMI)" value={fmt.number(s.gmi, 1)} unit="%" hint="Estimativa pela média do período" />
              <Stat
                label="Variabilidade (CV)"
                value={fmt.number(s.cv, 0)}
                unit="%"
                hint={s.cv === null ? 'Precisa de 2+ medições' : s.cv <= 36 ? 'Estável (≤ 36%)' : 'Instável (> 36%)'}
              />
              <Stat label="Medições" value={fmt.number(s.count)} hint={days ? `${fmt.number(s.count / days, 1)} por dia com registro` : undefined} />
            </div>
          </section>

          {s.count > 0 ? (
            <>
              <Panel title="Tempo em cada faixa" description={`Alvo: ${s.targets.low}–${s.targets.high} mg/dL. Meta usual: mais de 70% no alvo e menos de 4% abaixo.`}>
                <TimeInRange summary={s} />
              </Panel>

              <Panel title="Média diária" description="Linha: média do dia · traço cinza: menor e maior medição do dia · faixa verde: alvo.">
                <DailyChart summary={s} />
              </Panel>

              <Panel title="Perfil do dia" description="Média por hora do dia no período — mostra em que horários a glicose costuma subir.">
                <HourlyProfile summary={s} />
              </Panel>

              <p className="text-center text-xs text-subtle">
                Quer conferir os números? Veja a{' '}
                <Link to="/medicoes" className="underline underline-offset-2 hover:text-foreground">
                  lista completa de medições
                </Link>
                .
              </p>
            </>
          ) : (
            <Card className="p-8 text-center text-sm text-muted">Nenhuma medição neste período. Tente um período maior.</Card>
          )}
        </>
      )}
    </Page>
  )
}
