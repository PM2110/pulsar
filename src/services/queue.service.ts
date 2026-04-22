import { redisClient } from '../config/redis.config.js'

/**
 * Service to handle job queuing logic using Redis.
 */
export const queueService = {
  /**
   * Enqueues a job ID into a specific Redis Sorted Set with priority.
   * Score = (10 - priority) * 10,000,000,000,000 + timestamp
   * This ensures higher priority jobs have lower scores and come first.
   * @param queueName The name of the queue
   * @param jobId The ID of the job from the database
   * @param priority The priority level (higher is more important)
   */
  async enqueueJob(queueName: string, jobId: string | number, priority: number = 0): Promise<void> {
    try {
      const redisKey = `queue:${queueName}`
      const timestamp = Date.now()
      const score = (10 - priority) * 10000000000000 + timestamp

      // ZADD adds the job ID to the sorted set
      await redisClient.zAdd(redisKey, {
        score,
        value: jobId.toString()
      })

      console.log(`📡 Job ${jobId} enqueued in ${redisKey} with priority ${priority} (score: ${score})`)
    } catch (error) {
      console.error(`❌ Failed to enqueue job ${jobId}:`, error)
      throw error
    }
  },

  /**
   * Removes a job ID from a specific Redis Sorted Set.
   * @param queueName The name of the queue
   * @param jobId The ID of the job
   */
  async removeFromQueue(queueName: string, jobId: string | number): Promise<void> {
    try {
      const redisKey = `queue:${queueName}`
      // ZREM removes the member from the sorted set
      await redisClient.zRem(redisKey, jobId.toString())
      console.log(`🗑️ Job ${jobId} removed from ${redisKey}`)
    } catch (error) {
      console.error(`❌ Failed to remove job ${jobId} from ${queueName}:`, error)
    }
  }
}
