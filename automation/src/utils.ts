/**
 * Random delay utility — makes automation behaviour less predictable.
 * All Playwright interactions should use these between actions.
 */
export function randomDelay(min = 600, max = 2000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function randomSleep(min = 600, max = 2000): Promise<void> {
  return sleep(randomDelay(min, max))
}

/** Longer pause used between processing individual jobs (8–15 seconds). */
export async function jobPause(
  minMs = 8000,
  maxMs = 15000,
): Promise<void> {
  return sleep(randomDelay(minMs, maxMs))
}

/** Truncate a string for log display. */
export function truncate(s: string, max = 60): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}
