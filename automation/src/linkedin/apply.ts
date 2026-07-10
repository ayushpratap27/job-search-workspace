import type { Page } from 'playwright'
import type { ApplicationResult } from '../types'
import { randomSleep } from '../utils'

/**
 * Attempt to submit a LinkedIn Easy Apply application.
 *
 * Returns:
 *  - { status: 'completed' }         — successfully submitted
 *  - { status: 'skipped', reason }   — Easy Apply button not found (external portal)
 *  - { status: 'needs_attention', reason } — unknown form field or error
 */
export async function applyToJob(page: Page): Promise<ApplicationResult> {
  // Check if Easy Apply button exists
  const easyApplyBtn = await findEasyApplyButton(page)
  if (!easyApplyBtn) {
    return { status: 'skipped', reason: 'external_portal' }
  }

  await easyApplyBtn.click()
  await randomSleep(1500, 2500)

  // Handle modal steps
  const result = await handleEasyApplyModal(page)
  return result
}

async function findEasyApplyButton(page: Page) {
  const selectors = [
    'button[aria-label*="Easy Apply"]',
    'button.jobs-apply-button[aria-label*="Easy Apply"]',
    '.jobs-s-apply button:has-text("Easy Apply")',
    'button:has-text("Easy Apply")',
  ]

  for (const sel of selectors) {
    const btn = await page.$(sel)
    if (btn) return btn
  }
  return null
}

async function handleEasyApplyModal(page: Page): Promise<ApplicationResult> {
  const MAX_STEPS = 12

  for (let step = 0; step < MAX_STEPS; step++) {
    await randomSleep(800, 1500)

    // ── Check for success / dismissed modal ─────────────────────────────────
    const successMsg = await page.$('.artdeco-inline-feedback--success, [aria-label*="Application submitted"]')
    if (successMsg) return { status: 'completed' }

    // ── Check for submit button (final step) ─────────────────────────────────
    const submitBtn = await page.$(
      'button[aria-label*="Submit application"], button.jobs-apply-button[aria-label*="Submit"]',
    )
    if (submitBtn) {
      await submitBtn.click()
      await randomSleep(1500, 2500)
      return { status: 'completed' }
    }

    // ── Fill standard form fields before proceeding ───────────────────────────
    const fillResult = await fillCurrentStep(page)
    if (fillResult.needsAttention) {
      // Dismiss modal so we can continue to next job
      await dismissModal(page)
      return { status: 'needs_attention', reason: fillResult.reason ?? 'unknown_form' }
    }

    // ── Try next/review button ─────────────────────────────────────────────────
    const nextBtn = await page.$(
      'button[aria-label="Continue to next step"], ' +
      'button[aria-label="Review your application"], ' +
      'button[aria-label*="Next"]',
    )
    if (!nextBtn) {
      await dismissModal(page)
      return { status: 'needs_attention', reason: 'unknown_form' }
    }

    await nextBtn.click()
  }

  await dismissModal(page)
  return { status: 'needs_attention', reason: 'too_many_steps' }
}

interface FillResult {
  needsAttention: boolean
  reason?: string
}

/**
 * Fill fields in the current step of the Easy Apply modal.
 * Handles: contact info (pre-filled), phone number, resume selection,
 * and simple text/radio screening questions.
 */
async function fillCurrentStep(page: Page): Promise<FillResult> {
  // Phone number field — fill if empty
  const phoneField = await page.$('input[id*="phone"], input[name*="phone"]')
  if (phoneField) {
    const value = await phoneField.inputValue()
    if (!value) {
      await phoneField.fill('+91 9999999999')
      await randomSleep(300, 600)
    }
  }

  // Radio buttons — select first option if none selected
  const radios = await page.$$('fieldset input[type="radio"]')
  for (const group of await groupRadiosByName(page)) {
    const hasChecked = await Promise.any(group.map(r => r!.isChecked())).catch(() => false)
    if (!hasChecked && group[0]) {
      await group[0].check()
      await randomSleep(200, 400)
    }
  }
  // (radios array kept to avoid unused var warning)
  void radios

  // Select dropdowns — choose first non-placeholder option if unset
  const selects = await page.$$('select.fb-dropdown__select, select[name*="question"]')
  for (const sel of selects) {
    const value = await sel.inputValue()
    if (!value || value === '') {
      const options = await sel.$$('option')
      if (options.length > 1) {
        const firstValue = await options[1].getAttribute('value')
        if (firstValue) await sel.selectOption(firstValue)
        await randomSleep(200, 400)
      }
    }
  }

  // Check for text-area or complex file-upload fields we can't safely handle
  const fileInputs = await page.$$('input[type="file"]')
  if (fileInputs.length > 0) {
    // Let the default resume handle this — do nothing, just move on
  }

  // Textarea screening questions — skip if complex (flag needs_attention only if required)
  const requiredTextareas = await page.$$(
    'textarea[required], textarea[aria-required="true"]',
  )
  for (const ta of requiredTextareas) {
    const value = await ta.inputValue()
    if (!value) {
      return { needsAttention: true, reason: 'unknown_form' }
    }
  }

  return { needsAttention: false }
}

async function groupRadiosByName(page: Page): Promise<Array<Awaited<ReturnType<Page['$']>>[]>> {
  // Group radio buttons by their name attribute
  const allRadios = await page.$$('fieldset input[type="radio"]')
  const groups = new Map<string, typeof allRadios>()
  for (const r of allRadios) {
    const name = (await r.getAttribute('name')) ?? Math.random().toString()
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name)!.push(r)
  }
  return [...groups.values()]
}

async function dismissModal(page: Page): Promise<void> {
  try {
    const closeBtn = await page.$(
      'button[aria-label="Dismiss"], button[aria-label="Cancel"], button.artdeco-modal__dismiss',
    )
    if (closeBtn) {
      await closeBtn.click()
      await randomSleep(500, 1000)
    }
    // Confirm discard if prompted
    const discardBtn = await page.$('button[data-control-name="discard_application_confirm_btn"], button:has-text("Discard")')
    if (discardBtn) await discardBtn.click()
  } catch {
    // Best-effort dismissal
  }
}
