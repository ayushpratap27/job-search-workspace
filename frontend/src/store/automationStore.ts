import { create } from 'zustand'

interface SessionStats {
  jobsFound: number
  jobsApplied: number
  jobsSkipped: number
  jobsAttention: number
}

interface AutomationState {
  isRunning: boolean
  isPaused: boolean
  sessionId: string | null
  stats: SessionStats
  currentCompany: string | null
  currentRole: string | null
  interventionPending: boolean
  interventionReason: string | null
  interventionMessage: string | null

  // Actions
  setRunning: (sessionId: string) => void
  setJobFound: (company: string, role: string) => void
  setJobApplied: () => void
  setJobSkipped: () => void
  setNeedsAttention: (reason: string, message: string) => void
  setResumed: () => void
  setCompleted: () => void
  reset: () => void
}

const initialStats: SessionStats = { jobsFound: 0, jobsApplied: 0, jobsSkipped: 0, jobsAttention: 0 }

export const useAutomationStore = create<AutomationState>((set) => ({
  isRunning: false,
  isPaused: false,
  sessionId: null,
  stats: initialStats,
  currentCompany: null,
  currentRole: null,
  interventionPending: false,
  interventionReason: null,
  interventionMessage: null,

  setRunning: (sessionId) => set({ isRunning: true, isPaused: false, sessionId, stats: initialStats, interventionPending: false }),
  setJobFound: (company, role) => set(s => ({
    currentCompany: company,
    currentRole: role,
    stats: { ...s.stats, jobsFound: s.stats.jobsFound + 1 },
  })),
  setJobApplied: () => set(s => ({ stats: { ...s.stats, jobsApplied: s.stats.jobsApplied + 1 } })),
  setJobSkipped: () => set(s => ({ stats: { ...s.stats, jobsSkipped: s.stats.jobsSkipped + 1 } })),
  setNeedsAttention: (reason, message) => set({
    isPaused: true, isRunning: false,
    interventionPending: true, interventionReason: reason, interventionMessage: message,
    stats: (s => ({ ...s.stats, jobsAttention: s.stats.jobsAttention + 1 }))(useAutomationStore.getState()),
  }),
  setResumed: () => set({ isRunning: true, isPaused: false, interventionPending: false }),
  setCompleted: () => set({ isRunning: false, isPaused: false, interventionPending: false }),
  reset: () => set({ isRunning: false, isPaused: false, sessionId: null, stats: initialStats, interventionPending: false }),
}))
