import { redisClient } from '../config/redis.config.js'
import { query } from '../config/db.config.js'
import { DEFAULT_QUEUE } from '../config/queue.config.js'

/**
 * Service to handle worker logic: polling Redis and processing jobs.
 */
export const workerService = {
  isRunning: false,

  /**
   * Starts the worker loop.
   */
  async start(queueName: string = DEFAULT_QUEUE) {
    if (this.isRunning) return
    this.isRunning = true
    console.log(`🚀 Worker started polling queue: ${queueName}`)

    while (this.isRunning) {
      try {
        await this.pollAndProcess(queueName)
      } catch (error) {
        console.error('❌ Worker loop error:', error)
        // Wait a bit before retrying on error
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  },

  /**
   * Stops the worker loop.
   */
  stop() {
    this.isRunning = false
    console.log('🛑 Worker stopping...')
  },

  /**
   * Polls Redis for a job using blocking pop and processes it if found.
   */
  async pollAndProcess(queueName: string) {
    const redisKey = `queue:${queueName}`

    // bzPopMin blocks until an element is available or timeout (5s)
    // Returns { key: '...', value: 'jobId', score: 123 } or null
    const result = await redisClient.bzPopMin(redisKey, 5)

    if (!result) {
      // Timeout occurred, just return to loop and check isRunning
      return
    }

    const jobId = result.value
    console.log(`📦 Picked up job ${jobId} from ${queueName}`)

    try {
      // Fetch job from DB and update status to 'processing'
      const selectResult = await query(
        'UPDATE jobs SET status = \'processing\', updated_at = NOW() WHERE id = $1 RETURNING *',
        [jobId]
      )

      if (selectResult.rows.length === 0) {
        console.warn(`⚠️ Job ${jobId} found in Redis but not in DB. Skipping.`)
        return
      }

      const job = selectResult.rows[0]
      console.log(`⚙️ Processing job ${jobId} (Type: ${job.job_type})`)

      // Perform fake task for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mark as complete
      await query(
        'UPDATE jobs SET status = \'completed\', updated_at = NOW() WHERE id = $1',
        [jobId]
      )

      console.log(`✅ Job ${jobId} completed successfully`)
    } catch (error) {
      console.error(`❌ Failed to process job ${jobId}:`, error)
      // Basic error handling: mark as failed
      await query(
        'UPDATE jobs SET status = \'failed\', updated_at = NOW() WHERE id = $1',
        [jobId]
      )
    }
  }
}
