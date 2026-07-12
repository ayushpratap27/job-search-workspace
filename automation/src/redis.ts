import Redis from 'ioredis'

let client: Redis | null = null

export function getRedisClient(): Redis {
  if (!client) {
    const addr = process.env.REDIS_ADDR ?? 'localhost:6379'
    const [host, portStr] = addr.split(':')
    const port = parseInt(portStr ?? '6379', 10)
    const isUpstash = host?.includes('upstash.io') || host?.includes('redislabs.com')

    client = new Redis({
      host,
      port,
      password: process.env.REDIS_PASSWORD,
      // Enable TLS for cloud Redis providers (Upstash, Redis Labs)
      tls: isUpstash ? {} : undefined,
      lazyConnect: true,
    })

    client.on('error', (err) => {
      console.error('[redis] error:', err.message)
    })
  }
  return client
}
