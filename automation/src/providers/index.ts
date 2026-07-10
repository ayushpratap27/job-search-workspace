import { JobListing, RecentHire, ApplicationResult, JobSearchConfig } from '../types'

export interface JobPlatformProvider {
  readonly platform: string
  initialize(sessionPath: string): Promise<void>
  search(config: JobSearchConfig): Promise<JobListing[]>
  apply(job: JobListing): Promise<ApplicationResult>
  collectRecentHires(job: JobListing): Promise<RecentHire[]>
  detectBlocker(): Promise<{ blocked: boolean; reason?: string }>
  persistSession(sessionPath: string): Promise<void>
  close(): Promise<void>
}
