import type { GlucoseRange, MealTag } from '../types'

/** Ordem fixa das faixas, de baixo para alto. Nunca reordenar por valor. */
export const RANGE_ORDER: GlucoseRange[] = ['very_low', 'low', 'in_range', 'high', 'very_high']

export const RANGE_META: Record<GlucoseRange, { label: string; short: string; fill: string; bg: string; text: string }> = {
  very_low: { label: 'Muito baixa', short: 'Muito baixa', fill: 'var(--range-very-low)', bg: 'bg-range-very-low', text: 'text-range-very-low' },
  low: { label: 'Baixa', short: 'Baixa', fill: 'var(--range-low)', bg: 'bg-range-low', text: 'text-range-low' },
  in_range: { label: 'No alvo', short: 'No alvo', fill: 'var(--range-in)', bg: 'bg-range-in', text: 'text-range-in' },
  high: { label: 'Alta', short: 'Alta', fill: 'var(--range-high)', bg: 'bg-range-high', text: 'text-range-high' },
  very_high: { label: 'Muito alta', short: 'Muito alta', fill: 'var(--range-very-high)', bg: 'bg-range-very-high', text: 'text-range-very-high' },
}

export const MEAL_LABELS: Record<MealTag, string> = {
  none: 'Sem marcação',
  before_meal: 'Antes da refeição',
  after_meal: 'Depois da refeição',
}

export function classify(value: number, t: { very_low: number; low: number; high: number; very_high: number }): GlucoseRange {
  if (value < t.very_low) return 'very_low'
  if (value < t.low) return 'low'
  if (value <= t.high) return 'in_range'
  if (value <= t.very_high) return 'high'
  return 'very_high'
}

/** As datas vêm como hora local sem fuso ("2026-11-13T13:33:00"). */
export function parseLocal(value: string): Date {
  const [d, t = '00:00:00'] = value.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h, min, s] = t.split(':').map(Number)
  return new Date(y, m - 1, day, h, min, s || 0)
}

const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const weekdayDayMonth = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
const weekdayDayMonthYear = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const monthYear = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
const full = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })

export const fmt = {
  dayMonth: (v: string) => dayMonth.format(parseLocal(v)).replace('.', ''),
  /** "Sáb, 13 de nov" — inclui o ano quando não é o ano corrente. */
  weekday: (v: string) => {
    const d = parseLocal(v)
    const f = d.getFullYear() === new Date().getFullYear() ? weekdayDayMonth : weekdayDayMonthYear
    return capitalize(f.format(d).replace(/\./g, ''))
  },
  time: (v: string) => time.format(parseLocal(v)),
  full: (v: string) => full.format(parseLocal(v)),
  monthYear: (t: number) => monthYear.format(new Date(t)).replace('. de ', '/').replace('.', ''),
  number: (v: number | null | undefined, digits = 0) =>
    v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }),
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function relativeTime(value: string): string {
  const diffMin = Math.round((parseLocal(value).getTime() - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
  const abs = Math.abs(diffMin)
  if (abs < 60) return rtf.format(diffMin, 'minute')
  if (abs < 60 * 48) return rtf.format(Math.round(diffMin / 60), 'hour')
  if (abs < 60 * 24 * 60) return rtf.format(Math.round(diffMin / 1440), 'day')
  return rtf.format(Math.round(diffMin / 43200), 'month')
}
