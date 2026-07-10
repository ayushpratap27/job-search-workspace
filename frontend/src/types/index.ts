// ── Pagination ───────────────────────────────────────────────────────────────

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: Pagination
}

export interface ApiResponse<T> {
  success: boolean
  data: T
}

// ── Company ──────────────────────────────────────────────────────────────────

export interface Company {
  id: string
  name: string
  linkedinUrl: string | null
  careerPageUrl: string | null
  website: string | null
  platform: string
  createdAt: string
  updatedAt: string
}

export interface CompanySummary {
  id: string
  name: string
  linkedinUrl: string | null
  careerPageUrl: string | null
}

// ── Application ───────────────────────────────────────────────────────────────

export type ApplicationStatus = 'completed' | 'needs_attention' | 'skipped'

export type NetworkingStatus =
  | 'pending'
  | 'completed'
  | 'replied'
  | 'referral_received'
  | 'resume_received'
  | 'ignored'

export interface Application {
  id: string
  userId: string
  companyId: string
  sessionId: string | null
  company: CompanySummary
  role: string
  location: string | null
  priority: 1 | 2 | 3 | 4
  jobUrl: string
  applicationStatus: ApplicationStatus
  attentionReason: string | null
  networkingStatus: NetworkingStatus
  notes: string | null
  platform: string
  appliedAt: string | null
  recentHiresCount: number
  createdAt: string
  updatedAt: string
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string
  applicationId: string
  eventType: string
  eventData: Record<string, unknown>
  createdAt: string
}

// ── Recent Hires ──────────────────────────────────────────────────────────────

export interface RecentHire {
  id: string
  companyId: string
  companyName: string
  applicationId: string | null
  name: string
  designation: string | null
  joinedAt: string | null
  profileUrl: string | null
  platform: string
  createdAt: string
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  today: {
    date: string
    jobsFound: number
    applied: number
    needsAttention: number
    skipped: number
    recentHiresFound: number
  }
  cityBreakdown: {
    bangalore: number
    remote: number
    hyderabad: number
    pune: number
    noida: number
    gurugram: number
    chennai: number
    other: number
  }
  networking: {
    pending: number
    completed: number
  }
  thisWeek: { applied: number }
  thisMonth: { applied: number }
  activeSession: {
    id: string
    status: 'running' | 'paused'
    jobsApplied: number
    startedAt: string
  } | null
}

// ── Automation ────────────────────────────────────────────────────────────────

export interface JobSearchSession {
  id: string
  status: 'running' | 'paused' | 'completed' | 'failed'
  jobsFound: number
  jobsApplied: number
  jobsSkipped: number
  jobsAttention: number
  startedAt: string
  completedAt: string | null
}

// ── Notification ──────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  metadata: Record<string, unknown>
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Bengaluru',
  2: 'Remote',
  3: 'Tier 2',
  4: 'Other India',
}

export const NETWORKING_STATUS_LABELS: Record<NetworkingStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  replied: 'Replied',
  referral_received: 'Referral Received',
  resume_received: 'Resume Received',
  ignored: 'Ignored',
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  completed: 'Applied',
  needs_attention: 'Needs Attention',
  skipped: 'Skipped',
}
