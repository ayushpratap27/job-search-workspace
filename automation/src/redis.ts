import Redis from 'ioredis'

let client: Redis | null = null

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
    })

    client.on('error', (err) => {
      console.error('[redis] error:', err.message)
    })
  }
  return client
}
