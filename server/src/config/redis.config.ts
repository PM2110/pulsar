import { createClient, RedisClientType } from 'redis'
import { env } from './env.config.js'
import { logger } from '../utils/logger.js'

export const redisClient: RedisClientType = createClient({
  url: env.REDIS_URL
})

redisClient.on('error', (err) => logger.error('Redis Client Error', err, 'REDIS'))

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect()
    logger.info('Connected to Redis', 'REDIS')
  }
}
