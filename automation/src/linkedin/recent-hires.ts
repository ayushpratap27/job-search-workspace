import type { Page } from 'playwright'
import type { RecentHire } from '../types'
import { randomSleep } from '../utils'

/**
 * Navigate to the company's LinkedIn "People" page and collect visible recent hires.
 *
 * LinkedIn shows recent hires in a section titled "Recent hires" or similar.
 * We collect name, title, joined-at text, and profile URL from visible cards.
 * No clicking into individual profiles — only what is directly visible.
 */
export async function collectRecentHires(
  page: Page,
  companyLinkedInUrl: string,
): Promise<RecentHire[]> {
  if (!companyLinkedInUrl) return []

  // Navigate to the /people page of the company
  const peopleURL = companyLinkedInUrl.replace(/\/$/, '') + '/people/'
  try {
    await page.goto(peopleURL, { waitUntil: 'domcontentloaded', timeout: 20_000 })
  } catch {
    return []
  }
  await randomSleep(2000, 3500)

  const hires: RecentHire[] = []

  // Strategy 1: Look for a "Recent hires" labeled section
  try {
    const hireCards = await page.$$(
      'section[aria-label*="Recent hires"] li, ' +
      'section[aria-label*="recent"] li, ' +
      '.org-people-profile-card__profile-info',
    )

    for (const card of hireCards.slice(0, 15)) {
      const hire = await extractHireFromCard(card)
      if (hire.name) hires.push(hire)
    }
  } catch {
    // Section may not exist — fall through
  }

  // Strategy 2: Look for people cards with "joined" text (broader search)
  if (hires.length === 0) {
    try {
      const allCards = await page.$$('.artdeco-entity-lockup, .discover-entity-type-card')
      for (const card of allCards.slice(0, 20)) {
        const text = await card.innerText().catch(() => '')
        if (text.toLowerCase().includes('joined') || text.toLowerCase().includes('hired')) {
          const hire = await extractHireFromCard(card)
          if (hire.name) hires.push(hire)
        }
      }
    } catch {
      // No cards found
    }
  }

  return hires
}

async function extractHireFromCard(card: Awaited<ReturnType<Page['$']>>): Promise<RecentHire> {
  const hire: RecentHire = { name: '' }

  if (!card) return hire

  try {
    // Name
    hire.name = await card
      .$eval(
        '[data-anonymize="person-name"], .artdeco-entity-lockup__title, h3',
        (el: Element) => el.textContent?.trim() ?? '',
      )
      .catch(() => '')

    // Designation / role
    hire.designation = await card
      .$eval(
        '[data-anonymize="title"], .artdeco-entity-lockup__subtitle, h4',
        (el: Element) => el.textContent?.trim() ?? '',
      )
      .catch(() => undefined)

    // Joined at text
    hire.joinedAt = await card
      .$eval(
        '.org-people-profile-card__joined-date, span[class*="joined"], span[class*="date"]',
        (el: Element) => el.textContent?.trim() ?? '',
      )
      .catch(() => undefined)

    // Profile URL
    hire.profileUrl = await card
      .$eval('a', (el: Element) => (el as HTMLAnchorElement).href)
      .catch(() => undefined)

    // Clean up LinkedIn tracking parameters from profile URL
    if (hire.profileUrl) {
      hire.profileUrl = hire.profileUrl.split('?')[0]
    }
  } catch {
    // Partial data is fine — return what we have
  }

  return hire
}
