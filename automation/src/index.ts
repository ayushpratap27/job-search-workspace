import 'dotenv/config'
import Redis from 'ioredis'
import { getRedisClient } from './redis'
import { publishEvent } from './reporter'
import { saveCheckpoint, loadCheckpoint, clearCheckpoint } from './checkpoint'
import { LinkedInProvider } from './linkedin/provider'
import type { AutomationCommand, JobSearchConfig } from './types'

const SESSION_PATH = process.env.SESSION_PATH ?? './session/linkedin.json'

// Active provider reference (so pause/resume can control it)
let activeProvider: LinkedInProvider | null = null
let paused = false

async function main(): Promise<void> {
  const userId = process.env.USER_ID
  if (!userId) {
    throw new Error('USER_ID is required in environment variables')
  }

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
        await activeProvider?.close()
        activeProvider = null
        break
    }
  })

  process.on('SIGINT', async () => {
    console.log('[automation] shutting down...')
    await activeProvider?.close()
    await subscriber.quit()
    process.exit(0)
  })
}

async function runSession(userId: string, command: AutomationCommand): Promise<void> {
  const provider = new LinkedInProvider(SESSION_PATH)
  activeProvider = provider

  await publishEvent(userId, {
    type: 'automation:started',
    sessionId: command.sessionId,
    data: { sessionId: command.sessionId },
  })

  try {
    await provider.initialize()

    const config = command.config as JobSearchConfig
    const jobs = await provider.search(config)

    console.log(`[automation] found ${jobs.length} jobs after prioritization`)

    for (let i = 0; i < jobs.length; i++) {
      if (paused) {
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

      // Apply
      let result
      try {
        await publishEvent(userId, { type: 'automation:job_applying', sessionId: command.sessionId, data: { jobUrl: job.jobUrl, company: job.company, role: job.role } })
        result = await provider.apply(job)
      } catch (err: unknown) {
        const blocker = err as { blocked?: boolean; reason?: string; message?: string }
        if (blocker.blocked) {
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

      // Collect recent hires
      const hires = await provider.collectRecentHires(job).catch(() => [])
      if (hires.length > 0) {
        await publishEvent(userId, {
          type: 'recent_hires',
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
    await provider.close()
    activeProvider = null
  }
}

async function resumeSession(userId: string, command: AutomationCommand): Promise<void> {
  const checkpoint = await loadCheckpoint(command.sessionId)
  if (!checkpoint) {
    console.warn('[automation] no checkpoint found for session', command.sessionId)
    return
  }

  console.log(`[automation] resuming from job index ${checkpoint.currentIndex}`)

  // Build a command that continues from the checkpoint
  const resumeCommand: AutomationCommand = {
    ...command,
    // Skip to the checkpoint index by slicing the job list
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
