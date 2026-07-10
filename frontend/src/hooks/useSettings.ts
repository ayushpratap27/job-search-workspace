import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiResponse } from '@/types'

export interface SearchConfig {
  id: string
  keywords: string[]
  filters: {
    timeRange: string
    jobTypes: string[]
    easyApplyOnly: boolean
    under10Applicants: boolean
  }
  searchStartTime: string
  summaryTime: string
  maxJobsPerSession: number
  aiProvider: string
  isActive: boolean
}

export interface SearchConfigUpdate {
  keywords?: string[]
  filters?: Record<string, unknown>
  priorityOrder?: Record<string, unknown>
  searchStartTime?: string
  summaryTime?: string
  maxJobsPerSession?: number
  aiProvider?: string
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<{ searchConfig: SearchConfig }>>('/settings')
      return data.data
    },
  })
}

export function useUpdateSearchConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SearchConfigUpdate) =>
      api.put('/settings/search-config', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useUpdateEmailSettings() {
  return useMutation({
    mutationFn: (body: {
      smtpHost: string
      smtpPort: number
      smtpUser: string
      smtpPassword: string
      recipientEmail: string
    }) => api.put('/settings/email', body),
  })
}
