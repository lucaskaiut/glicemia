import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/constants/query-keys'
import { toast } from '@/shared/stores/toast.store'
import { glucoseService, type DeviceUpdatePayload, type ManualReadingPayload } from '../services/glucose.service'
import type { MealTag, ReadingFilters } from '../types'

export function useGlucoseSummary(params: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.glucose.summary(params),
    queryFn: () => glucoseService.summary(params),
    placeholderData: keepPreviousData,
  })
}

export function useGlucoseReadings(filters: ReadingFilters) {
  return useQuery({
    queryKey: queryKeys.glucose.readings({ ...filters }),
    queryFn: () => glucoseService.readings(filters),
    placeholderData: keepPreviousData,
  })
}

export function useGlucoseDevices() {
  return useQuery({
    queryKey: queryKeys.glucose.devices(),
    queryFn: glucoseService.devices,
  })
}

export function useCreateReading() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ManualReadingPayload) => glucoseService.createReading(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.glucose.all })
      toast.success('Medição registrada', 'Ela já entra nas médias do período.')
    },
  })
}

export function useUpdateReading() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; meal_tag?: MealTag; notes?: string | null }) =>
      glucoseService.updateReading(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.glucose.all })
      toast.success('Medição atualizada')
    },
  })
}

export function useDeleteReading() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => glucoseService.removeReading(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.glucose.all })
      toast.success('Medição removida')
    },
  })
}

export function useUpdateDevice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...payload }: DeviceUpdatePayload & { id: string }) =>
      glucoseService.updateDevice(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.glucose.all })
      toast.success('Aparelho atualizado', 'Os horários das medições foram recalculados.')
    },
  })
}
