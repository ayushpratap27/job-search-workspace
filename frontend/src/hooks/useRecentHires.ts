import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { RecentHire, PaginatedResponse } from '@/types'

export function useRecentHires(params: { companyId?: string; applicationId?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['recent-hires', params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<RecentHire>>('/recent-hires', { params })
      return data
    },
  })
}
