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

    // Wait longer — LinkedIn's JS redirect to /login can take 3-5 seconds
    await randomSleep(5000, 6000)

    const currentUrl = this.page.url()
    const onAuthPage =
      currentUrl.includes('/login') ||
      currentUrl.includes('/authwall') ||
      currentUrl.includes('/checkpoint') ||
      currentUrl.includes('/uas/')

    // Secondary check: look for an element that only exists when logged in
    const loggedInElement = await this.page
      .$(`.global-nav__me, .feed-identity-module, [data-control-name="identity_nav_top"]`)
      .catch(() => null)

    const notLoggedIn = onAuthPage || !loggedInElement

    if (notLoggedIn) {
      // Delete stale session file to prevent the same empty-session loop next run
      const fs = await import('fs')
      if (fs.existsSync(this.sessionPath)) {
        fs.unlinkSync(this.sessionPath)
        console.log('[session] Deleted stale/empty session file')
      }

      console.log('[session] Not logged in to LinkedIn.')
      console.log('[session] Please log in manually in the open browser window.')
      console.log('[session] The automation will continue automatically once you log in.')
      console.log('[session] Waiting up to 5 minutes...')

      try {
        await this.page.waitForURL(
          (url) => {
            const u = url.toString()
            return (
              !u.includes('/login') &&
              !u.includes('/authwall') &&
              !u.includes('/checkpoint') &&
              !u.includes('/uas/')
            )
          },
          { timeout: 5 * 60 * 1000 },
        )
        // Extra wait after login to let the page settle
        await randomSleep(3000, 5000)
        console.log('[session] Login detected! Saving session and continuing...')
      } catch {
        throw Object.assign(
          new Error(
            'LinkedIn login timed out (5 min). Please log in and click Start Automation again.',
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
