import { redisClient } from '../config/redis.config.js'

/**
 * Service to handle job queuing logic using Redis.
 */
export const queueService = {
  /**
   * Enqueues a job ID into a specific Redis list.
   * @param queueName The name of the queue (e.g., 'default', 'notifications')
   * @param jobId The ID of the job from the database
   */
  async enqueueJob(queueName: string, jobId: string | number): Promise<void> {
    try {
      const redisKey = `queue:${queueName}`
      // RPUSH adds the job ID to the tail of the list
      await redisClient.rPush(redisKey, jobId.toString())
      console.log(`📡 Job ${jobId} enqueued in ${redisKey}`)
    } catch (error) {
      console.error(`❌ Failed to enqueue job ${jobId}:`, error)
      throw error
    }
  },

  /**
   * Removes a job ID from a specific Redis list.
   * @param queueName The name of the queue
   * @param jobId The ID of the job
   */
  async removeFromQueue(queueName: string, jobId: string | number): Promise<void> {
    try {
      const redisKey = `queue:${queueName}`
      // LREM key count value: removes first 'count' occurrences of 'value'
      // 1 means remove one occurrence starting from head
      await redisClient.lRem(redisKey, 1, jobId.toString())
      console.log(`🗑️ Job ${jobId} removed from ${redisKey}`)
    } catch (error) {
      console.error(`❌ Failed to remove job ${jobId} from ${queueName}:`, error)
      // Usually non-critical, but worth logging
    }
  }
}
