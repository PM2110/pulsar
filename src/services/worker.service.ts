import { redisClient } from '../config/redis.config.js'
import { query } from '../config/db.config.js'
import { DEFAULT_QUEUE } from '../config/queue.config.js'
import { queueService } from './queue.service.js'

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

    let job: any
    let attemptId: string | number | undefined

    try {
      // Fetch job from DB, increment attempts and update status to 'processing'
      const startResult = await query(
        `UPDATE jobs 
         SET status = 'processing', 
             attempts = attempts + 1, 
             updated_at = NOW() 
         WHERE id = $1 RETURNING *`,
        [jobId]
      )

      if (startResult.rows.length === 0) {
        console.warn(`⚠️ Job ${jobId} found in Redis but not in DB. Skipping.`)
        return
      }

      job = startResult.rows[0]
      console.log(`⚙️ Processing job ${jobId} (Type: ${job.job_type}, Attempt: ${job.attempts}/${job.max_attempts})`)

      // Log attempt start in job_attempts
      const attemptResult = await query(
        `INSERT INTO job_attempts (job_id, attempt_number, status, worker_id, started_at)
         VALUES ($1, $2, 'processing', $3, NOW()) RETURNING id`,
        [jobId, job.attempts, 'worker-1']
      )
      attemptId = attemptResult.rows[0].id

      // Simulate random failure (30% chance)
      const shouldFail = Math.random() < 0.3
      if (shouldFail) {
        throw new Error('SIMULATED_FAILURE: Random processing error occurred.')
      }

      // Perform fake task for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mark as complete
      await query(
        'UPDATE jobs SET status = \'completed\', completed_at = NOW(), updated_at = NOW() WHERE id = $1',
        [jobId]
      )

      // Update attempt log
      await query(
        'UPDATE job_attempts SET status = \'completed\', finished_at = NOW() WHERE id = $1',
        [attemptId]
      )

      console.log(`✅ Job ${jobId} completed successfully`)
    } catch (error: any) {
      console.error(`❌ Failed to process job ${jobId}:`, error.message)
      const errorMessage = error.message || 'Unknown error'

      if (job) {
        const canRetry = job.attempts < job.max_attempts
        const newStatus = canRetry ? 'pending' : 'failed'

        // Update job status
        await query(
          `UPDATE jobs 
           SET status = $1, 
               last_error = $2, 
               updated_at = NOW(), 
               failed_at = $3
           WHERE id = $4`,
          [newStatus, errorMessage, canRetry ? null : new Date(), jobId]
        )

        // Update attempt log
        if (attemptId) {
          await query(
            'UPDATE job_attempts SET status = \'failed\', error = $1, finished_at = NOW() WHERE id = $2',
            [errorMessage, attemptId]
          )
        }

        if (canRetry) {
          console.log(`🔄 Requeuing job ${jobId} (Attempt ${job.attempts} failed, will retry)`)
          await queueService.enqueueJob(queueName, jobId, job.priority)
        } else {
          console.log(`💀 Job ${jobId} failed after ${job.attempts} attempts.`)
        }
      }
    }
  }
}
