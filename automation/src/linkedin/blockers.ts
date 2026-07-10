import type { Page } from 'playwright'

export interface BlockerResult {
  blocked: boolean
  reason?: 'captcha' | 'otp_email' | 'otp_phone' | 'session_expired' | 'unknown'
  message?: string
}

/**
 * Run after each significant page action to check whether LinkedIn
 * has interrupted the flow with a challenge or redirect.
 */
export async function detectBlocker(page: Page): Promise<BlockerResult> {
  const url = page.url()

  // ── Session expired / logged out ──────────────────────────────────────────
  if (
    url.includes('/login') ||
    url.includes('/authwall') ||
    url.includes('/checkpoint/challenge')
  ) {
    return {
      blocked: true,
      reason: 'session_expired',
      message: 'LinkedIn redirected to login. Your session has expired — please log in again and click Resume.',
    }
  }

  // ── CAPTCHA ───────────────────────────────────────────────────────────────
  const captchaIndicators = [
    '#captcha-internal',
    '[id*="captcha"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'div[class*="captcha"]',
  ]
  for (const sel of captchaIndicators) {
    const el = await page.$(sel)
    if (el) {
      return {
        blocked: true,
        reason: 'captcha',
        message: 'CAPTCHA challenge detected. Please solve it in the browser window and click Resume.',
      }
    }
  }

  // ── Email OTP ────────────────────────────────────────────────────────────
  const pageText = await getVisibleText(page)
  if (
    pageText.includes('Enter the code') ||
    pageText.includes('verification code') ||
    pageText.includes('code sent to your email')
  ) {
    return {
      blocked: true,
      reason: 'otp_email',
      message: 'Email OTP required. Enter the code in the browser window and click Resume.',
    }
  }

  // ── Phone OTP ────────────────────────────────────────────────────────────
  if (
    pageText.includes('Verify your phone') ||
    pageText.includes('code sent to your phone') ||
    pageText.includes('mobile verification')
  ) {
    return {
      blocked: true,
      reason: 'otp_phone',
      message: 'Phone OTP required. Enter the code in the browser window and click Resume.',
    }
  }

  // ── LinkedIn checkpoint (generic 2FA / security check) ───────────────────
  if (
    url.includes('/checkpoint/') ||
    url.includes('/security-verification') ||
    pageText.includes('unusual activity')
  ) {
    return {
      blocked: true,
      reason: 'unknown',
      message: 'LinkedIn security checkpoint detected. Complete the verification and click Resume.',
    }
  }

  return { blocked: false }
}

async function getVisibleText(page: Page): Promise<string> {
  return page
    .evaluate(() => document.body?.innerText?.toLowerCase() ?? '')
    .catch(() => '')
}
