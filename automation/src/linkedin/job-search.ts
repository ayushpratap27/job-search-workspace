import type { Page } from 'playwright'
import type { JobSearchConfig, JobListing } from '../types'
import { randomSleep, truncate } from '../utils'

/** India geo ID for LinkedIn search */
const INDIA_GEO_ID = '102713980'

/**
 * Build the LinkedIn jobs search URL from config.
 * Searches across all of India; city prioritization is done post-collection.
 */
export function buildSearchURL(keywords: string[], filters: JobSearchConfig['filters']): string {
  const params = new URLSearchParams()
  params.set('keywords', keywords.join(' OR '))
  params.set('geoId', INDIA_GEO_ID)
  params.set('location', 'India')
  params.set('sortBy', 'DD') // date descending

  // Time filter: last 24 hours
  if (filters?.timeRange === '24h') {
    params.set('f_TPR', 'r86400')
  }

  const jobTypes: string[] = ((filters as Record<string, unknown>)?.jobTypes as string[]) ?? []
  const types: string[] = []
  if (jobTypes.includes('full_time')) types.push('F')
  if (jobTypes.includes('internship')) types.push('I')
  if (types.length) params.set('f_JT', types.join(','))

  // Easy Apply filter
  if (filters?.easyApplyOnly) params.set('f_LF', 'f_AL')

  return `https://www.linkedin.com/jobs/search/?${params.toString()}`
}

/**
 * Navigate to the search URL and collect all visible job card URLs.
 * Paginates through results until maxJobs is reached or no more pages.
 */
export async function collectJobURLs(
  page: Page,
  searchURL: string,
  maxJobs: number,
): Promise<string[]> {
  console.log(`[job-search] navigating to search: ${truncate(searchURL)}`)
  await page.goto(searchURL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await randomSleep(2000, 4000)

  const urls = new Set<string>()

  for (let pageNum = 0; urls.size < maxJobs; pageNum++) {
    // Scroll down to load lazy-rendered job cards
    await scrollJobList(page)
    await randomSleep(1000, 2000)

    // Collect job card links from the current page
    const links = await page.$$eval(
      'a.job-card-list__title, a[data-tracking-control-name*="job_card"]',
      (els: Element[]) =>
        els
          .map(el => (el as HTMLAnchorElement).href)
          .filter(href => href.includes('/jobs/view/')),
    )

    for (const link of links) {
      const clean = link.split('?')[0] // strip query params
      if (clean) urls.add(clean)
      if (urls.size >= maxJobs) break
    }

    console.log(`[job-search] page ${pageNum + 1}: ${urls.size} jobs collected`)

    if (urls.size >= maxJobs) break

    // Try to navigate to the next page
    const advanced = await goToNextPage(page)
    if (!advanced) break

    await randomSleep(2000, 3500)
  }

  return [...urls].slice(0, maxJobs)
}

/**
 * Open a single job listing and extract all metadata.
 */
export async function extractJobDetails(
  page: Page,
  jobURL: string,
): Promise<Partial<JobListing>> {
  await page.goto(jobURL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await randomSleep(1500, 3000)

  const details: Partial<JobListing> = { jobUrl: jobURL }

  try {
    // Job title
    details.role = await page
      .$eval(
        'h1.job-details-jobs-unified-top-card__job-title, h1.t-24',
        (el: Element) => el.textContent?.trim() ?? '',
      )
      .catch(() => '')

    // Company name
    details.company = await page
      .$eval(
        '.job-details-jobs-unified-top-card__company-name a, .job-details-jobs-unified-top-card__company-name',
        (el: Element) => el.textContent?.trim() ?? '',
      )
      .catch(() => '')

    // Location
    details.location = await page
      .$eval(
        '.job-details-jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-container span',
        (el: Element) => el.textContent?.trim() ?? '',
      )
      .catch(() => '')

    // Posted time
    details.postedAt = await page
      .$eval(
        'span.job-details-jobs-unified-top-card__posted-date, span[aria-label*="ago"]',
        (el: Element) => el.textContent?.trim() ?? '',
      )
      .catch(() => '')

    // Company LinkedIn URL
    details.companyLinkedInUrl = await page
      .$eval(
        '.job-details-jobs-unified-top-card__company-name a',
        (el: Element) => (el as HTMLAnchorElement).href,
      )
      .catch(() => undefined)

    // Company career page (often in "About the company" section)
    details.careerPageUrl = await page
      .$eval(
        'a[data-tracking-control-name*="jobs_jd_top_card_company_url"], .jobs-company__url a',
        (el: Element) => (el as HTMLAnchorElement).href,
      )
      .catch(() => undefined)
  } catch (err) {
    console.warn(`[job-search] extract details error for ${jobURL}: ${err}`)
  }

  return details
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function scrollJobList(page: Page): Promise<void> {
  // Scroll the job list panel to trigger lazy loading
  await page.evaluate(() => {
    const list = document.querySelector('.jobs-search-results-list, .scaffold-layout__list')
    if (list) {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
    } else {
      window.scrollBy(0, 600)
    }
  })
  await randomSleep(800, 1500)
}

async function goToNextPage(page: Page): Promise<boolean> {
  try {
    const nextBtn = await page.$(
      'button[aria-label="View next page"], li.artdeco-pagination__indicator--number.selected + li button',
    )
    if (!nextBtn) return false
    const disabled = await nextBtn.getAttribute('disabled')
    if (disabled !== null) return false
    await nextBtn.click()
    return true
  } catch {
    return false
  }
}
