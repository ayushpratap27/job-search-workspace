import { getRedisClient } from './redis'
import { CheckpointState } from './types'

const TTL_SECONDS = 86400 // 24 hours

export async function saveCheckpoint(state: CheckpointState): Promise<void> {
  const redis = getRedisClient()
  await redis.set(
    `automation:checkpoint:${state.sessionId}`,
    JSON.stringify(state),
    'EX',
    TTL_SECONDS
  )
}

export async function loadCheckpoint(
  sessionId: string
): Promise<CheckpointState | null> {
  const redis = getRedisClient()
  const raw = await redis.get(`automation:checkpoint:${sessionId}`)
  if (!raw) return null
  return JSON.parse(raw) as CheckpointState
}

export async function clearCheckpoint(sessionId: string): Promise<void> {
  const redis = getRedisClient()
  await redis.del(`automation:checkpoint:${sessionId}`)
}
