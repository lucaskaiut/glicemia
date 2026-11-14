import { http } from '@/shared/api/http'
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api'
import type { GlucoseDevice, GlucoseReading, GlucoseSummary, MealTag, ReadingFilters } from '../types'

const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export interface ManualReadingPayload {
  measured_at: string
  value_mg_dl: number
  meal_tag?: MealTag
  notes?: string | null
}

export interface DeviceUpdatePayload {
  name?: string | null
  clock_offset_seconds?: number
  clock_offsets?: Array<{ from_sequence: number; offset_seconds: number }>
  split_at_device_time?: string
  split_offset_seconds?: number
  clock_fixed?: boolean
}

export const glucoseService = {
  async summary(params: { from?: string; to?: string }): Promise<GlucoseSummary> {
    const response = await http.get<ApiResponse<GlucoseSummary>>('/glucose/summary', { params: clean(params) })

    return response.data.data
  },

  async readings(params: ReadingFilters): Promise<PaginatedResponse<GlucoseReading>> {
    const response = await http.get<PaginatedResponse<GlucoseReading>>('/glucose/readings', { params: clean(params) })

    return response.data
  },

  async createReading(payload: ManualReadingPayload): Promise<GlucoseReading> {
    const response = await http.post<ApiResponse<GlucoseReading>>('/glucose/readings', payload)

    return response.data.data
  },

  async updateReading(id: string, payload: { meal_tag?: MealTag; notes?: string | null }): Promise<GlucoseReading> {
    const response = await http.patch<ApiResponse<GlucoseReading>>(`/glucose/readings/${id}`, payload)

    return response.data.data
  },

  async removeReading(id: string): Promise<void> {
    await http.delete(`/glucose/readings/${id}`)
  },

  async devices(): Promise<GlucoseDevice[]> {
    const response = await http.get<ApiResponse<GlucoseDevice[]>>('/glucose/devices')

    return response.data.data
  },

  async updateDevice(id: string, payload: DeviceUpdatePayload): Promise<GlucoseDevice> {
    const response = await http.patch<ApiResponse<GlucoseDevice>>(`/glucose/devices/${id}`, payload)

    return response.data.data
  },
}
