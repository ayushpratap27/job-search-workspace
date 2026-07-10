import { chromium, type BrowserContext, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

/** User-agent string matching a real Mac + Chrome setup. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/125.0.0.0 Safari/537.36'

let _browser: Browser | null = null
let _context: BrowserContext | null = null

export async function launchBrowser(headless = false): Promise<Browser> {
  if (_browser) return _browser

  _browser = await chromium.launch({
    headless,
    slowMo: Number(process.env.BROWSER_SLOW_MO_MS ?? '50'),
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-size=1440,900',
    ],
  })

  return _browser
}

export async function createContext(
  sessionPath: string,
  headless = false,
): Promise<BrowserContext> {
  if (_context) return _context

  const browser = await launchBrowser(headless)

  const contextOptions: Parameters<Browser['newContext']>[0] = {
    viewport: { width: 1440, height: 900 },
    userAgent: USER_AGENT,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    permissions: ['notifications'],
  }

  // Load persisted session if it exists
  if (fs.existsSync(sessionPath)) {
    console.log(`[session] loading existing session from ${sessionPath}`)
    contextOptions.storageState = sessionPath
  } else {
    console.log('[session] no saved session found — user must log in manually')
  }

  _context = await browser.newContext(contextOptions)

  // Patch navigator.webdriver to avoid trivial bot detection
  await _context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    // @ts-expect-error — intentionally deleting automation flag
    delete navigator.__proto__.webdriver
  })

  return _context
}

/**
 * Save the current browser context's cookies and storage to disk.
 * Call this after a successful LinkedIn login so future runs skip the login step.
 */
export async function saveSession(sessionPath: string): Promise<void> {
  if (!_context) return

  const dir = path.dirname(sessionPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  await _context.storageState({ path: sessionPath })
  console.log(`[session] session saved to ${sessionPath}`)
}

export function sessionExists(sessionPath: string): boolean {
  return fs.existsSync(sessionPath)
}

export async function closeBrowser(): Promise<void> {
  if (_context) { await _context.close(); _context = null }
  if (_browser) { await _browser.close(); _browser = null }
}
