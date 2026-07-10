import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { wsClient } from '@/lib/websocket'
import { useAutomationStore } from '@/store/automationStore'
import { useAuthStore } from '@/store/authStore'
import type { AutomationEvent } from '@/lib/websocket'

// Initialise WebSocket and wire events into the Zustand store.
// Call this once at the top of the app.
export function useAutomationSocket() {
  const accessToken = useAuthStore(s => s.accessToken)
  const store = useAutomationStore()

  useEffect(() => {
    if (!accessToken) return

    // Bug #6 fix: pass a getter so reconnect always reads the latest token from localStorage
    wsClient.connect(() => localStorage.getItem('access_token'))

    const off = wsClient.on((event: AutomationEvent) => {
      switch (event.type) {
        case 'automation:started':
          store.setRunning((event.data.sessionId as string) ?? '')
          break
        case 'automation:job_found':
          store.setJobFound(event.data.company as string, event.data.role as string)
          break
        case 'automation:job_applied':
          store.setJobApplied()
          break
        case 'automation:job_skipped':
          store.setJobSkipped()
          break
        case 'automation:needs_attention':
          store.setNeedsAttention(event.data.reason as string, event.data.message as string ?? '')
          if (Notification.permission === 'granted') {
            new Notification('Action Required', { body: event.data.reason as string })
          }
          break
        case 'automation:resumed':
          store.setResumed()
          break
        case 'automation:completed':
        case 'automation:error':
          store.setCompleted()
          break
      }
    })

    return () => {
      off()
      wsClient.disconnect()
    }
  }, [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useStartAutomation() {
  const store = useAutomationStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (opts?: { maxJobs?: number }) =>
      api.post('/automation/start', opts ?? {}).then(r => r.data.data),
    onSuccess: (data) => {
      store.setRunning(data.sessionId)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function usePauseAutomation() {
  return useMutation({
    mutationFn: () => api.post('/automation/pause'),
  })
}

export function useResumeAutomation() {
  const store = useAutomationStore()
  return useMutation({
    mutationFn: (sessionId: string) => api.post('/automation/resume', { sessionId }),
    onSuccess: () => store.setResumed(),
  })
}
