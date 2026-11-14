import { useState } from 'react'
import { cn } from '@/shared/utils/cn'
import type { GlucoseSummary } from '../types'
import { RANGE_META, RANGE_ORDER, fmt } from '../utils/glucose'

/**
 * Barra segmentada de tempo em cada faixa + legenda com valores em texto.
 * Segmentos separados por 2px de superfície; percentuais sempre visíveis na legenda.
 */
export function TimeInRange({ summary }: { summary: GlucoseSummary }) {
  const [hover, setHover] = useState<string | null>(null)
  const t = summary.targets

  const bounds: Record<string, string> = {
    very_low: `< ${t.very_low}`,
    low: `${t.very_low}–${t.low - 1}`,
    in_range: `${t.low}–${t.high}`,
    high: `${t.high + 1}–${t.very_high}`,
    very_high: `> ${t.very_high}`,
  }

  return (
    <div>
      <div className="flex h-4 w-full gap-0.5" role="img" aria-label="Distribuição das medições por faixa">
        {RANGE_ORDER.map((range) => {
          const pct = summary.ranges[range].percent
          if (pct === 0) return null
          return (
            <div
              key={range}
              className={cn(
                'h-full transition-opacity first:rounded-l-sm last:rounded-r-sm',
                RANGE_META[range].bg,
                hover && hover !== range && 'opacity-40',
              )}
              style={{ width: `${pct}%`, minWidth: 3 }}
              onMouseEnter={() => setHover(range)}
              onMouseLeave={() => setHover(null)}
              title={`${RANGE_META[range].label}: ${fmt.number(pct, 1)}%`}
            />
          )
        })}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        {RANGE_ORDER.map((range) => (
          <li
            key={range}
            className={cn('transition-opacity', hover && hover !== range && 'opacity-50')}
            onMouseEnter={() => setHover(range)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className={cn('size-2 rounded-full', RANGE_META[range].bg)} aria-hidden="true" />
              {RANGE_META[range].label}
            </span>
            <span className="mt-0.5 block font-display text-2xl text-foreground">
              {fmt.number(summary.ranges[range].percent, 0)}
              <span className="text-base text-muted">%</span>
            </span>
            <span className="text-[11px] text-subtle">
              {bounds[range]} mg/dL · {summary.ranges[range].count} leit.
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
