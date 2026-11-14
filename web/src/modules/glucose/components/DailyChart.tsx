import { useMemo, useState } from 'react'
import type { GlucoseSummary } from '../types'
import { RANGE_META, classify, fmt, isoDate, parseLocal } from '../utils/glucose'
import { ChartTooltip } from './ChartTooltip'
import { useElementWidth } from './useElementWidth'

const HEIGHT = 260
const M = { top: 16, right: 16, bottom: 28, left: 40 }
const DAY = 86400000

/**
 * Média diária (linha + pontos) com a amplitude mín–máx de cada dia (traço vertical)
 * sobre a faixa-alvo sombreada. Série única: o título do card a nomeia, sem legenda.
 */
export function DailyChart({ summary }: { summary: GlucoseSummary }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const { daily, targets } = summary

  const geo = useMemo(() => {
    const innerW = width - M.left - M.right
    const innerH = HEIGHT - M.top - M.bottom
    const times = daily.map((d) => parseLocal(d.date).getTime())
    const t0 = times[0] ?? 0
    const t1 = Math.max(times[times.length - 1] ?? 1, t0 + DAY)
    const yMax = Math.max(300, Math.ceil(Math.max(...daily.map((d) => d.max), 0) / 50) * 50)
    const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * innerW
    const y = (v: number) => M.top + innerH - (v / yMax) * innerH
    const ticks = Array.from({ length: yMax / 50 + 1 }, (_, i) => i * 50).filter((v) => v % 100 === 0 || yMax <= 300)

    // Quebra a linha quando faltam dias, para não inventar continuidade.
    const segments: string[] = []
    let current = ''
    daily.forEach((d, i) => {
      const gap = i > 0 && times[i] - times[i - 1] > DAY * 1.5
      const cmd = `${x(times[i]).toFixed(1)},${y(d.mean).toFixed(1)}`
      if (i === 0 || gap) {
        if (current) segments.push(current)
        current = `M${cmd}`
      } else current += ` L${cmd}`
    })
    if (current) segments.push(current)

    // Rótulos do eixo X espaçados pelo tempo (os dias com medição não são contínuos).
    const span = t1 - t0
    const nTicks = Math.max(2, Math.min(daily.length, Math.floor(innerW / 90)))
    const longSpan = span > DAY * 120
    const xTicks = Array.from({ length: nTicks }, (_, i) => t0 + (span * i) / (nTicks - 1))

    return { innerW, innerH, times, x, y, yMax, ticks, segments, xTicks, longSpan }
  }, [daily, width])

  if (daily.length === 0) {
    return <div ref={ref} className="flex h-64 items-center justify-center text-sm text-muted">Sem medições no período.</div>
  }

  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left + M.left
    let best = 0
    geo.times.forEach((t, i) => {
      if (Math.abs(geo.x(t) - px) < Math.abs(geo.x(geo.times[best]) - px)) best = i
    })
    setActive(best)
  }

  const a = active !== null ? daily[active] : null

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={HEIGHT} role="img" aria-label="Média glicêmica diária com mínimo e máximo de cada dia">
        {/* Faixa-alvo */}
        <rect
          x={M.left}
          width={geo.innerW}
          y={geo.y(targets.high)}
          height={geo.y(targets.low) - geo.y(targets.high)}
          fill="var(--range-in)"
          opacity={0.09}
        />
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={M.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" className="fill-subtle text-[10px]">
              {v}
            </text>
          </g>
        ))}
        {[targets.low, targets.high].map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--range-in)" strokeWidth={1} strokeDasharray="3 4" opacity={0.7} />
            <text x={width - M.right} y={geo.y(v) - 4} textAnchor="end" className="fill-muted text-[10px]">
              {v}
            </text>
          </g>
        ))}

        {/* Amplitude diária */}
        {daily.map((d, i) => (
          <line
            key={`r${d.date}`}
            x1={geo.x(geo.times[i])}
            x2={geo.x(geo.times[i])}
            y1={geo.y(d.min)}
            y2={geo.y(d.max)}
            stroke="var(--app-fg-subtle)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={active === null || active === i ? 0.55 : 0.25}
          />
        ))}

        {geo.segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--app-primary)" strokeWidth={2} strokeLinejoin="round" />
        ))}

        {daily.map((d, i) => (
          <circle
            key={`p${d.date}`}
            cx={geo.x(geo.times[i])}
            cy={geo.y(d.mean)}
            r={active === i ? 5.5 : 4}
            fill={RANGE_META[classify(d.mean, targets)].fill}
            stroke="var(--app-surface)"
            strokeWidth={2}
          />
        ))}

        {geo.xTicks.map((t, i) => (
          <text
            key={`x${t}`}
            x={geo.x(t)}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
            className="fill-subtle text-[10px]"
          >
            {geo.longSpan ? fmt.monthYear(t) : fmt.dayMonth(isoDate(new Date(t)))}
          </text>
        ))}

        {a && (
          <line x1={geo.x(geo.times[active!])} x2={geo.x(geo.times[active!])} y1={M.top} y2={M.top + geo.innerH} stroke="var(--app-fg-muted)" strokeWidth={1} opacity={0.4} />
        )}

        <rect
          x={M.left}
          y={M.top}
          width={geo.innerW}
          height={geo.innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {a && (
        <ChartTooltip x={geo.x(geo.times[active!])} y={geo.y(a.max)} width={width}>
          <p className="font-medium">{fmt.weekday(a.date)}</p>
          <p className="mt-1 text-muted">
            Média <span className="font-semibold text-foreground">{fmt.number(a.mean)} mg/dL</span>
          </p>
          <p className="text-muted">
            Mín {a.min} · Máx {a.max} · {a.count} {a.count === 1 ? 'leitura' : 'leituras'}
          </p>
        </ChartTooltip>
      )}
    </div>
  )
}
