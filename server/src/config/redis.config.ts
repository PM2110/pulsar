import { createClient, RedisClientType } from 'redis'
import { env } from './env.config.js'

export const redisClient: RedisClientType = createClient({
  url: env.REDIS_URL
})

redisClient.on('error', (err) => console.error('Redis Client Error', err))

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect()
    console.log('Connected to Redis')
  }
}
