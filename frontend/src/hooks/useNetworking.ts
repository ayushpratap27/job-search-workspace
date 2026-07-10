import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Application, PaginatedResponse, NetworkingStatus } from '@/types'

export function useNetworking(status: NetworkingStatus = 'pending', page = 1) {
  return useQuery({
    queryKey: ['networking', status, page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Application>>('/networking', {
        params: { status, page, pageSize: 20 },
      })
      return data
    },
  })
}

export function useUpdateNetworkingStatus(applicationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (networkingStatus: NetworkingStatus) =>
      api.patch(`/networking/${applicationId}`, { networkingStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['networking'] })
      qc.invalidateQueries({ queryKey: ['application', applicationId] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
