import 'dotenv/config'
import Redis from 'ioredis'
import { getRedisClient } from './redis'
import { AutomationCommand } from './types'

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
        console.log('[automation] start — provider not yet implemented')
        break
      case 'pause':
        console.log('[automation] pause')
        break
      case 'resume':
        console.log('[automation] resume')
        break
      case 'stop':
        console.log('[automation] stop')
        break
      default:
        console.warn('[automation] unknown command:', command.cmd)
    }
  })

  process.on('SIGINT', async () => {
    console.log('[automation] shutting down...')
    await subscriber.quit()
    process.exit(0)
  })
}

main().catch((err: Error) => {
  console.error('[automation] fatal:', err.message)
  process.exit(1)
})
