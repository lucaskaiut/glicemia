export type GlucoseRange = 'very_low' | 'low' | 'in_range' | 'high' | 'very_high'
export type MealTag = 'none' | 'before_meal' | 'after_meal'

export interface GlucoseReading {
  id: string
  measured_at: string
  device_measured_at: string | null
  value_mg_dl: number
  range: GlucoseRange
  meal_tag: MealTag
  source: 'device' | 'manual'
  notes: string | null
  device?: { id: string; model: string; name: string | null } | null
  created_at: string | null
}

export interface ClockPeriodEdge {
  device_measured_at: string
  measured_at: string
  value_mg_dl: number
}

export interface ClockPeriod {
  from_sequence: number
  offset_seconds: number
  readings_count: number
  first: ClockPeriodEdge | null
  last: ClockPeriodEdge | null
}

export interface GlucoseDevice {
  id: string
  model: string
  identifier: string
  name: string | null
  clock_offset_seconds: number
  clock_periods: ClockPeriod[]
  readings_count?: number
  last_synced_at: string | null
  last_sync_result: { received: number; created: number; duplicates: number } | null
  created_at: string | null
}

export interface GlucoseSummary {
  period: { from: string | null; to: string | null; first_at: string | null; last_at: string | null }
  targets: { very_low: number; low: number; high: number; very_high: number }
  count: number
  mean: number | null
  median: number | null
  min: number | null
  max: number | null
  std_dev: number | null
  cv: number | null
  gmi: number | null
  ranges: Record<GlucoseRange, { count: number; percent: number }>
  daily: Array<{ date: string; count: number; mean: number; min: number; max: number }>
  hourly: Array<{ hour: number; count: number; mean: number | null }>
  latest: { measured_at: string; value_mg_dl: number; range: GlucoseRange } | null
}

export interface ReadingFilters {
  from?: string
  to?: string
  range?: GlucoseRange
  meal_tag?: MealTag
  page?: number
  per_page?: number
}
