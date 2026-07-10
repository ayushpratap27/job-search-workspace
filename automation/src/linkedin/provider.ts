import type { Page } from 'playwright'
import type { JobPlatformProvider } from '../providers'
import type { JobSearchConfig, JobListing, RecentHire, ApplicationResult } from '../types'
import { createContext, saveSession, closeBrowser } from './session'
import { buildSearchURL, collectJobURLs, extractJobDetails } from './job-search'
import { prioritizeJobs } from './prioritize'
import { applyToJob } from './apply'
import { collectRecentHires } from './recent-hires'
import { detectBlocker } from './blockers'
import { randomSleep, jobPause, truncate } from '../utils'

export class LinkedInProvider implements JobPlatformProvider {
  readonly platform = 'linkedin'

  private page: Page | null = null
  private sessionPath: string

  constructor(sessionPath: string) {
    this.sessionPath = sessionPath
  }

  async initialize(): Promise<void> {
    const headless = process.env.BROWSER_HEADLESS === 'true'
    const ctx = await createContext(this.sessionPath, headless)
    this.page = await ctx.newPage()

    // Request desktop notifications permission is already set in context
    await this.page.goto('https://www.linkedin.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await randomSleep(2000, 3000)

    // Save session after every page load so it's always fresh
    await saveSession(this.sessionPath)
  }

  async search(config: JobSearchConfig): Promise<JobListing[]> {
    if (!this.page) throw new Error('provider not initialized')

    const searchURL = buildSearchURL(config.keywords, config.filters)
    const rawURLs = await collectJobURLs(this.page, searchURL, config.maxJobs)

    console.log(`[linkedin] collected ${rawURLs.length} job URLs`)

    // Extract details for each job
    const jobs: JobListing[] = []
    for (const url of rawURLs) {
      const details = await extractJobDetails(this.page, url)

      // Check for blocker after navigating
      const blocker = await detectBlocker(this.page)
      if (blocker.blocked) {
        console.warn(`[linkedin] blocker after navigating to ${url}: ${blocker.reason}`)
        throw Object.assign(new Error(blocker.message ?? 'Blocker detected'), blocker)
      }

      jobs.push({
        jobUrl: url,
        company: details.company ?? 'Unknown',
        role: details.role ?? 'Unknown',
        location: details.location ?? '',
        companyLinkedInUrl: details.companyLinkedInUrl,
        careerPageUrl: details.careerPageUrl,
        postedAt: details.postedAt,
      })

      await randomSleep(1000, 2000)
    }

    return prioritizeJobs(jobs, config.priorityOrder ?? [])
  }

  async apply(job: JobListing): Promise<ApplicationResult> {
    if (!this.page) throw new Error('provider not initialized')

    // Navigate to the job posting
    await this.page.goto(job.jobUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await randomSleep(1500, 2500)

    // Check for blocker before applying
    const blocker = await detectBlocker(this.page)
    if (blocker.blocked) {
      throw Object.assign(new Error(blocker.message ?? 'Blocker detected'), blocker)
    }

    console.log(`[linkedin] applying to ${truncate(job.company)} — ${truncate(job.role)}`)
    const result = await applyToJob(this.page)

    // Brief pause after application
    await randomSleep(1000, 2000)

    return result
  }

  async collectRecentHires(job: JobListing): Promise<RecentHire[]> {
    if (!this.page) throw new Error('provider not initialized')

    if (!job.companyLinkedInUrl) return []

    const hires = await collectRecentHires(this.page, job.companyLinkedInUrl)
    console.log(`[linkedin] collected ${hires.length} recent hires for ${job.company}`)

    await jobPause()
    return hires
  }

  async detectBlocker(): Promise<{ blocked: boolean; reason?: string }> {
    if (!this.page) return { blocked: false }
    return detectBlocker(this.page)
  }

  async persistSession(): Promise<void> {
    await saveSession(this.sessionPath)
  }

  async close(): Promise<void> {
    await closeBrowser()
    this.page = null
  }
}
