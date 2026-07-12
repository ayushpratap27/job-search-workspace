import 'dotenv/config'
import Redis from 'ioredis'
import { getRedisClient } from './redis'
import { publishEvent } from './reporter'
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from './checkpoint'
import { LinkedInProvider } from './linkedin/provider'
import type { AutomationCommand, JobSearchConfig, JobListing } from './types'

const SESSION_PATH = process.env.SESSION_PATH ?? './session/linkedin.json'

let activeProvider: LinkedInProvider | null = null
let paused = false
// When automation pauses for user action (login, CAPTCHA), keep the browser open
let browserShouldClose = true

async function main(): Promise<void> {
  const userId = process.env.USER_ID
  if (!userId) throw new Error('USER_ID is required in environment variables')

  const subscriber: Redis = getRedisClient().duplicate()
  const channel = `automation:commands:${userId}`

  await subscriber.subscribe(channel)
  console.log(`[automation] listening on ${channel}`)

  subscriber.on('message', async (_chan: string, message: string) => {
    let command: AutomationCommand
    try {
      command = JSON.parse(message) as AutomationCommand
    } catch {
      console.error('[automation] invalid command payload:', message)
      return
    }

    console.log(`[automation] received command: ${command.cmd} (session: ${command.sessionId})`)

    switch (command.cmd) {
      case 'start':
        paused = false
        runSession(userId, command).catch(err =>
          console.error('[automation] session error:', err.message),
        )
        break
      case 'pause':
        paused = true
        console.log('[automation] paused — will stop at next job boundary')
        break
      case 'resume':
        paused = false
        resumeSession(userId, command).catch(err =>
          console.error('[automation] resume error:', err.message),
        )
        break
      case 'stop':
        paused = true
        browserShouldClose = true
        await activeProvider?.close()
        activeProvider = null
        break
    }
  })

  process.on('SIGINT', async () => {
    console.log('[automation] shutting down...')
    browserShouldClose = true
    await activeProvider?.close()
    await subscriber.quit()
    process.exit(0)
  })
}

async function runSession(userId: string, command: AutomationCommand): Promise<void> {
  browserShouldClose = true // assume we close unless pausing for user action

  const provider = new LinkedInProvider(SESSION_PATH)
  activeProvider = provider

  await publishEvent(userId, {
    type: 'automation:started',
    sessionId: command.sessionId,
    data: { sessionId: command.sessionId },
  })

  try {
    const config = command.config as JobSearchConfig

    // Initialize + search wrapped together so blockers become needs_attention
    let jobs: JobListing[]
    try {
      await provider.initialize()
      jobs = await provider.search(config)
    } catch (err: unknown) {
      const blocker = err as { blocked?: boolean; reason?: string; message?: string }
      if (blocker.blocked) {
        browserShouldClose = false // keep browser open so user can interact
        await publishEvent(userId, {
          type: 'automation:needs_attention',
          sessionId: command.sessionId,
          data: { reason: blocker.reason ?? 'blocker', message: blocker.message ?? 'Automation paused.' },
        })
        return
      }
      throw err
    }

    console.log(`[automation] found ${jobs.length} jobs after prioritization`)

    for (let i = 0; i < jobs.length; i++) {
      if (paused) {
        browserShouldClose = false
        await saveCheckpoint({
          sessionId: command.sessionId,
          currentIndex: i,
          jobUrls: jobs.map(j => j.jobUrl),
          completedIds: [],
          pauseReason: 'manual_pause',
        })
        await publishEvent(userId, {
          type: 'automation:needs_attention',
          sessionId: command.sessionId,
          data: { reason: 'manual_pause', message: 'Automation paused by user.' },
        })
        return
      }

      const job = jobs[i]!

      await publishEvent(userId, {
        type: 'automation:job_found',
        sessionId: command.sessionId,
        data: { jobUrl: job.jobUrl, company: job.company, role: job.role, location: job.location, priority: job.priority },
      })

      let result
      try {
        await publishEvent(userId, {
          type: 'automation:job_applying',
          sessionId: command.sessionId,
          data: { jobUrl: job.jobUrl, company: job.company, role: job.role },
        })
        result = await provider.apply(job)
      } catch (err: unknown) {
        const blocker = err as { blocked?: boolean; reason?: string; message?: string }
        if (blocker.blocked) {
          browserShouldClose = false
          await saveCheckpoint({
            sessionId: command.sessionId,
            currentIndex: i,
            jobUrls: jobs.map(j => j.jobUrl),
            completedIds: [],
            pausedJobUrl: job.jobUrl,
            pauseReason: blocker.reason,
          })
          await publishEvent(userId, {
            type: 'automation:needs_attention',
            sessionId: command.sessionId,
            data: { reason: blocker.reason, message: blocker.message, jobUrl: job.jobUrl },
          })
          return
        }
        result = { status: 'skipped' as const, reason: 'error' }
      }

      if (result.status === 'needs_attention') {
        browserShouldClose = false
        await saveCheckpoint({
          sessionId: command.sessionId,
          currentIndex: i + 1,
          jobUrls: jobs.map(j => j.jobUrl),
          completedIds: [],
          pausedJobUrl: job.jobUrl,
          pauseReason: result.reason,
        })
        await publishEvent(userId, {
          type: 'automation:needs_attention',
          sessionId: command.sessionId,
          data: { reason: result.reason, jobUrl: job.jobUrl, message: `Application for ${job.company} requires your attention.` },
        })
        return
      }

      if (result.status === 'completed') {
        await publishEvent(userId, {
          type: 'automation:job_applied',
          sessionId: command.sessionId,
          data: { jobUrl: job.jobUrl, company: job.company, role: job.role, location: job.location, companyLinkedInUrl: job.companyLinkedInUrl, priority: job.priority },
        })
      } else {
        await publishEvent(userId, {
          type: 'automation:job_skipped',
          sessionId: command.sessionId,
          data: { jobUrl: job.jobUrl, company: job.company, role: job.role, reason: result.reason },
        })
      }

      const hires = await provider.collectRecentHires(job).catch(() => [])
      if (hires.length > 0) {
        await publishEvent(userId, {
          type: 'automation:recent_hires',
          sessionId: command.sessionId,
          data: { applicationJobUrl: job.jobUrl, hires },
        })
      }

      await provider.persistSession()
    }

    await clearCheckpoint(command.sessionId)
    await publishEvent(userId, {
      type: 'automation:completed',
      sessionId: command.sessionId,
      data: { jobsFound: jobs.length },
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[automation] fatal session error:', msg)
    await publishEvent(userId, {
      type: 'automation:error',
      sessionId: command.sessionId,
      data: { message: msg },
    })
  } finally {
    // Only close the browser if we are NOT pausing for user action
    if (browserShouldClose) {
      await provider.close()
      activeProvider = null
    } else {
      console.log('[automation] browser kept open — waiting for user action')
    }
  }
}

async function resumeSession(userId: string, command: AutomationCommand): Promise<void> {
  const checkpoint = await loadCheckpoint(command.sessionId)
  if (!checkpoint) {
    console.warn('[automation] no checkpoint found for session', command.sessionId)
    return
  }

  console.log(`[automation] resuming from job index ${checkpoint.currentIndex}`)

  const resumeCommand: AutomationCommand = {
    cmd: 'start',
    sessionId: command.sessionId,
    userId: command.userId,
    config: {
      ...(command.config as JobSearchConfig),
      _resumeJobUrls: checkpoint.jobUrls.slice(checkpoint.currentIndex),
    } as JobSearchConfig,
  }

  await publishEvent(userId, {
    type: 'automation:resumed',
    sessionId: command.sessionId,
    data: {},
  })

  await runSession(userId, resumeCommand)
}

main().catch((err: Error) => {
  console.error('[automation] fatal:', err.message)
  process.exit(1)
})
