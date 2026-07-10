export interface AutomationCommand {
  cmd: 'start' | 'pause' | 'resume' | 'stop'
  sessionId: string
  userId: string
  config?: JobSearchConfig
}

export interface JobSearchConfig {
  keywords: string[]
  maxJobs: number
  filters: Record<string, unknown>
  priorityOrder: string[]
}

export interface AutomationEvent {
  type:
    | 'job_found'
    | 'job_applying'
    | 'job_applied'
    | 'job_skipped'
    | 'recent_hires'
    | 'needs_attention'
    | 'session_done'
    | 'session_error'
    | 'resumed'
  sessionId: string
  data: Record<string, unknown>
  timestamp: string
}

export interface JobListing {
  jobUrl: string
  company: string
  role: string
  location: string
  companyLinkedInUrl?: string
  careerPageUrl?: string
  postedAt?: string
  priority?: number
}

export interface RecentHire {
  name: string
  designation?: string
  joinedAt?: string
  profileUrl?: string
}

export interface ApplicationResult {
  status: 'completed' | 'needs_attention' | 'skipped'
  reason?: string
}

export interface CheckpointState {
  sessionId: string
  currentIndex: number
  jobUrls: string[]
  completedIds: string[]
  pausedJobUrl?: string
  pauseReason?: string
}
