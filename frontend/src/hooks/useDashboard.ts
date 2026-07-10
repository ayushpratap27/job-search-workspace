import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { ApiResponse, DashboardStats } from '@/types'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats')
      return data.data
    },
    refetchInterval: 30_000, // refresh every 30s while automation is running
  })
}
