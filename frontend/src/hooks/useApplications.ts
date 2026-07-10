import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Application, PaginatedResponse, TimelineEvent, ApiResponse } from '@/types'

export interface ApplicationFilters {
  company?: string
  role?: string
  location?: string
  status?: string
  networkingStatus?: string
  priority?: number
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: string
  page?: number
  pageSize?: number
}

export function useApplications(filters: ApplicationFilters = {}) {
  return useQuery({
    queryKey: ['applications', filters],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Application>>('/applications', {
        params: filters,
      })
      return data
    },
  })
}

export function useApplication(id: string) {
  return useQuery({
    queryKey: ['application', id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Application>>(`/applications/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useApplicationTimeline(id: string) {
  return useQuery({
    queryKey: ['application', id, 'timeline'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<TimelineEvent[]>>(`/applications/${id}/timeline`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useUpdateApplication(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { notes?: string; networkingStatus?: string; applicationStatus?: string }) =>
      api.put(`/applications/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application', id] })
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })
}
