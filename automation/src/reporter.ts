import { getRedisClient } from './redis'
import { AutomationEvent } from './types'

export async function publishEvent(
  userId: string,
  event: Omit<AutomationEvent, 'timestamp'>
): Promise<void> {
  const redis = getRedisClient()
  const payload: AutomationEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  }
  await redis.publish(`automation:events:${userId}`, JSON.stringify(payload))
}
