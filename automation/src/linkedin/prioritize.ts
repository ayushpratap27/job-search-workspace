import type { JobListing } from '../types'

/**
 * City → priority mapping.
 * Priority 1 = highest (Bengaluru), 4 = lowest (Other India).
 * The order list comes from the user's search_config.priority_order.
 */

const CITY_KEYWORDS: Record<string, string[]> = {
  bangalore: ['bangalore', 'bengaluru', 'blr'],
  remote:    ['remote', 'work from home', 'wfh', 'anywhere'],
  hyderabad: ['hyderabad', 'hyd', 'secunderabad'],
  pune:      ['pune', 'pimpri'],
  noida:     ['noida', 'greater noida'],
  gurugram:  ['gurugram', 'gurgaon'],
  chennai:   ['chennai', 'madras'],
}

/**
 * Assign a numeric priority to a job listing based on its location.
 * Lower number = higher priority.
 * 
 * @param location  The location string from LinkedIn
 * @param order     The user-configured priority order array e.g. ["bangalore","remote","other"]
 */
export function assignPriority(location: string | undefined, order: string[]): 1 | 2 | 3 | 4 {
  if (!location) return 4

  const loc = location.toLowerCase()

  for (let i = 0; i < order.length; i++) {
    const city = order[i].toLowerCase()
    const aliases = CITY_KEYWORDS[city] ?? [city]
    if (aliases.some(alias => loc.includes(alias))) {
      // Map index position to priority value 1–4
      if (i === 0) return 1
      if (i === 1) return 2
      if (i <= 3) return 3
      return 4
    }
  }

  return 4 // Other India
}

/**
 * Sort a list of job listings by assigned priority (lowest number first).
 */
export function prioritizeJobs(jobs: JobListing[], priorityOrder: string[]): JobListing[] {
  return [...jobs]
    .map(job => ({
      ...job,
      priority: assignPriority(job.location, priorityOrder),
    }))
    .sort((a, b) => (a.priority ?? 4) - (b.priority ?? 4))
}
