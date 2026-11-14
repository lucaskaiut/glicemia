import type { ReactNode } from 'react'

export function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 90), width - 90)

  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-surface px-3 py-2 text-xs whitespace-nowrap text-foreground shadow-pop"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  )
}
