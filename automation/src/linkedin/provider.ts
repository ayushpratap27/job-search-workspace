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

    await this.page.goto('https://www.linkedin.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await randomSleep(2000, 3000)

    // Check if we're actually logged in
    const currentUrl = this.page.url()
    if (
      currentUrl.includes('/login') ||
      currentUrl.includes('/authwall') ||
      currentUrl.includes('/checkpoint')
    ) {
      console.log('[session] Not logged in to LinkedIn.')
      console.log('[session] Please log in manually in the browser window.')
      console.log('[session] Waiting up to 5 minutes for login...')

      try {
        await this.page.waitForURL(
          (url) =>
            !url.toString().includes('/login') &&
            !url.toString().includes('/authwall') &&
            !url.toString().includes('/checkpoint'),
          { timeout: 5 * 60 * 1000 }, // 5 minutes
        )
        console.log('[session] Login detected! Saving session...')
        await randomSleep(2000, 3000)
      } catch {
        throw Object.assign(
          new Error(
            'LinkedIn login timed out. Please start automation again after logging in.',
          ),
          { blocked: true, reason: 'session_expired' as const },
        )
      }
    }

    // Save session only after confirmed login
    await saveSession(this.sessionPath)
  }

  async search(config: JobSearchConfig): Promise<JobListing[]> {
    if (!this.page) throw new Error('provider not initialized')

    // When resuming from checkpoint, use the saved URLs directly
    if (config._resumeJobUrls && config._resumeJobUrls.length > 0) {
      console.log(`[linkedin] resuming with ${config._resumeJobUrls.length} saved job URLs`)
      const jobs: JobListing[] = []
      for (const url of config._resumeJobUrls) {
        const details = await extractJobDetails(this.page, url)
        const blocker = await detectBlocker(this.page)
        if (blocker.blocked) {
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
      return jobs
    }

    const searchURL = buildSearchURL(config.keywords, config.filters)
    const rawURLs = await collectJobURLs(this.page, searchURL, config.maxJobs)

    console.log(`[linkedin] collected ${rawURLs.length} job URLs`)

    const jobs: JobListing[] = []
    for (const url of rawURLs) {
      const details = await extractJobDetails(this.page, url)

      const blocker = await detectBlocker(this.page)
      if (blocker.blocked) {
        console.warn(`[linkedin] blocker detected: ${blocker.reason}`)
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
