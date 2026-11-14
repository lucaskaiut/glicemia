import { cn } from '@/shared/utils/cn'
import type { GlucoseRange } from '../types'
import { RANGE_META } from '../utils/glucose'

/** Faixa sempre com rótulo em texto — a cor nunca carrega a informação sozinha. */
export function RangeBadge({ range, className }: { range: GlucoseRange; className?: string }) {
  const meta = RANGE_META[range]

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-muted', className)}>
      <span className={cn('size-2 rounded-full', meta.bg)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}
