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
  /** Internal: set by resume flow to continue from a specific job list */
  _resumeJobUrls?: string[]
}

export interface AutomationEvent {
  type: string
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
