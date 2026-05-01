import { redisClient } from '../config/redis.config.js'
import { query } from '../config/db.config.js'

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

  async enqueueJob(queueName: string, jobId: string | number, priority: number = 0, scoreTimestamp?: number): Promise<void> {
    try {
      const redisKey = `queue:${queueName}`
      const timestamp = scoreTimestamp || Date.now()
      const score = (10 - priority) * 10000000000000 + timestamp

      await redisClient.zAdd(redisKey, {
        score,
        value: jobId.toString()
      })

      console.log(`📡 Job ${jobId} enqueued in ${redisKey} (Score: ${score}, BaseTime: ${timestamp})`)
    } catch (error) {
      console.error(`❌ Failed to enqueue job ${jobId}:`, error)
      throw error
    }
  },

  /**
   * Enqueues a job into a delayed Redis Sorted Set.
   * Score is the timestamp when it should be run.
   */
  async enqueueDelayedJob(queueName: string, jobId: string | number, priority: number, runAt: number): Promise<void> {
    try {
      const redisKey = `delayed:queue:${queueName}`
      // Value includes priority so we can re-enqueue it correctly later
      const value = `${jobId}:${priority}`

      await redisClient.zAdd(redisKey, {
        score: runAt,
        value
      })

      console.log(`⏳ Job ${jobId} scheduled in ${redisKey} for ${new Date(runAt).toISOString()}`)
    } catch (error) {
      console.error(`❌ Failed to schedule job ${jobId}:`, error)
      throw error
    }
  },

  /**
   * Promotes ready jobs from delayed queue to main queue.
   * Returns ms until next job is due.
   */
  async promoteDelayedJobs(queueName: string): Promise<number | null> {
    try {
      const delayedKey = `delayed:queue:${queueName}`
      const now = Date.now()

      // 1. Get all jobs that are ready to be promoted (with their scheduled scores)
      const readyJobs = await redisClient.zRangeByScoreWithScores(delayedKey, '-inf', now)

      if (readyJobs.length > 0) {
        for (const { value: val, score: originalRunAt } of readyJobs) {
          // Atomically remove from delayed queue to "claim" the job for promotion
          const removed = await redisClient.zRem(delayedKey, val)

          if (removed === 1) {
            const [jobId, priorityStr] = val.split(':')
            const priority = parseInt(priorityStr, 10)

            console.log(`🚀 Promoting job ${jobId} (scheduled for ${new Date(originalRunAt).toISOString()})`)
            // Move to main queue using its original scheduled time for ranking
            await this.enqueueJob(queueName, jobId, priority, originalRunAt)
          }
        }
      }

      // 2. Check when the next job is due to return "sleep" time
      const nextJob = await redisClient.zRangeWithScores(delayedKey, 0, 0)
      if (nextJob.length > 0) {
        const nextRunAt = nextJob[0].score
        return Math.max(0, nextRunAt - now)
      }

      return null
    } catch (error) {
      console.error(`❌ Failed to promote jobs from ${queueName}:`, error)
      return null
    }
  },

  /**
   * Removes a job ID from a specific Redis Sorted Set.
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
  },

  /**
   * Re-synchronizes pending jobs from the DB to Redis if they are missing.
   * Looks for jobs in 'pending' status that haven't been updated for 5 minutes.
   */
  async reSyncPendingJobs(queueName: string): Promise<number> {
    try {
      // Find jobs in 'pending' status that were updated more than 5 minutes ago
      const staleResult = await query(
        `SELECT id, priority, queue_name 
         FROM jobs 
         WHERE status = 'pending' 
           AND queue_name = $1
           AND (updated_at < NOW() - INTERVAL '5 minutes' OR updated_at IS NULL)
         LIMIT 100`,
        [queueName]
      )

      let resyncedCount = 0
      for (const job of staleResult.rows) {
        // Just re-enqueue. Redis ZADD will update the score if it already exists,
        // or add it if it was missing.
        await this.enqueueJob(job.queue_name, job.id, job.priority)
        
        // Update updated_at so we don't keep picking it up every loop
        await query('UPDATE jobs SET updated_at = NOW() WHERE id = $1', [job.id])
        resyncedCount++
      }

      if (resyncedCount > 0) {
        console.log(`♻️ Reaper re-synced ${resyncedCount} stuck jobs for queue: ${queueName}`)
      }
      return resyncedCount
    } catch (error) {
      console.error(`❌ Reaper failed for ${queueName}:`, error)
      return 0
    }
  }
}
