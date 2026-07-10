import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import type { Notification, PaginatedResponse, ApiResponse } from '@/types'

export function useNotifications(onlyUnread = false, page = 1) {
  return useQuery({
    queryKey: ['notifications', onlyUnread, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, pageSize: 30 }
      if (onlyUnread) params.isRead = 'false'
      const { data } = await api.get<PaginatedResponse<Notification>>('/notifications', { params })
      return data
    },
    refetchInterval: 30_000,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<ApiResponse<{ id: string; isRead: boolean }>>(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
