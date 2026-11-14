import { useState } from 'react'
import type { GlucoseSummary } from '../types'
import { RANGE_META, classify, fmt } from '../utils/glucose'
import { ChartTooltip } from './ChartTooltip'
import { useElementWidth } from './useElementWidth'

const HEIGHT = 200
const M = { top: 12, right: 8, bottom: 26, left: 36 }

/** Média por hora do dia — a cor da barra indica a faixa da média (com rótulo no tooltip). */
export function HourlyProfile({ summary }: { summary: GlucoseSummary }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const { hourly, targets } = summary

  const innerW = width - M.left - M.right
  const innerH = HEIGHT - M.top - M.bottom
  const yMax = Math.max(250, Math.ceil(Math.max(...hourly.map((h) => h.mean ?? 0)) / 50) * 50)
  const slot = innerW / 24
  const barW = Math.max(4, slot - 2)
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH
  const a = active !== null ? hourly[active] : null

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={HEIGHT} role="img" aria-label="Média glicêmica por hora do dia">
        {[0, 100, 200, 300, 400].filter((v) => v <= yMax).map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" />
            <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-subtle text-[10px]">{v}</text>
          </g>
        ))}
        <line x1={M.left} x2={width - M.right} y1={y(targets.high)} y2={y(targets.high)} stroke="var(--range-in)" strokeDasharray="3 4" opacity={0.7} />

        {hourly.map((h, i) => {
          const x = M.left + i * slot + (slot - barW) / 2
          if (h.mean === null) {
            return <rect key={h.hour} x={x} y={y(0) - 1} width={barW} height={1} fill="var(--chart-grid)" />
          }
          const top = y(h.mean)
          const r = Math.min(4, barW / 2)
          const bottom = y(0)
          // Cantos arredondados só na ponta de dados; base reta no eixo.
          const path = `M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${bottom} Z`
          return (
            <path
              key={h.hour}
              d={path}
              fill={RANGE_META[classify(h.mean, targets)].fill}
              opacity={active === null || active === i ? 1 : 0.35}
            />
          )
        })}

        {hourly.filter((h) => h.hour % 3 === 0).map((h) => (
          <text key={h.hour} x={M.left + h.hour * slot + slot / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-subtle text-[10px]">
            {String(h.hour).padStart(2, '0')}h
          </text>
        ))}

        {hourly.map((h, i) => (
          <rect
            key={`hit${h.hour}`}
            x={M.left + i * slot}
            y={M.top}
            width={slot}
            height={innerH}
            fill="transparent"
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          />
        ))}
      </svg>

      {a && (
        <ChartTooltip x={M.left + a.hour * slot + slot / 2} y={a.mean !== null ? y(a.mean) : y(0)} width={width}>
          <p className="font-medium">
            {String(a.hour).padStart(2, '0')}h – {String((a.hour + 1) % 24).padStart(2, '0')}h
          </p>
          {a.mean === null ? (
            <p className="text-muted">Sem medições</p>
          ) : (
            <>
              <p className="mt-1 text-muted">
                Média <span className="font-semibold text-foreground">{fmt.number(a.mean)} mg/dL</span>
              </p>
              <p className="text-muted">
                {RANGE_META[classify(a.mean, targets)].label} · {a.count} {a.count === 1 ? 'leitura' : 'leituras'}
              </p>
            </>
          )}
        </ChartTooltip>
      )}
    </div>
  )
}
