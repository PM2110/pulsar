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
   * Starts the worker loop and the scheduler.
   */
  async start(queueName: string = DEFAULT_QUEUE) {
    if (this.isRunning) return
    this.isRunning = true
    console.log(`🚀 Worker started polling queue: ${queueName}`)

    // Start scheduler in background
    this.startScheduler()

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
   * Periodically checks Redis delayed queue for jobs that are due and promotes them.
   */
  async startScheduler(queueName: string = DEFAULT_QUEUE) {
    console.log(`⏰ Redis Scheduler started for queue: ${queueName}`)
    
    while (this.isRunning) {
      try {
        // Promote ready jobs and get wait time until next job
        const nextWait = await queueService.promoteDelayedJobs(queueName)
        
        // Smart sleep: if a job is due soon, wait for it, otherwise default to 5s
        const sleepTime = nextWait !== null ? Math.min(5000, nextWait) : 5000
        
        if (nextWait !== null && nextWait < 5000) {
          console.log(`💤 Next job due in ${nextWait}ms. Sleeping...`)
        }

        await new Promise(resolve => setTimeout(resolve, sleepTime))
      } catch (error) {
        console.error('❌ Scheduler error:', error)
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
   * Calculates exponential backoff delay: 5s * 2^(attempts-1)
   */
  calculateBackoff(attempts: number): number {
    const baseDelay = 5000 // 5 seconds
    return baseDelay * Math.pow(2, attempts - 1)
  },

  /**
   * Polls Redis for a job using blocking pop and processes it if found.
   */
  async pollAndProcess(queueName: string) {
    const redisKey = `queue:${queueName}`

    // bzPopMin blocks until an element is available or timeout (5s)
    const result = await redisClient.bzPopMin(redisKey, 5)

    if (!result) return

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

      // Determine if the job should fail (custom logic for demo/debugging)
      let shouldFail = false
      if (job.failure_mode === 'fail') {
        shouldFail = true
      } else if (job.failure_mode === 'succeed') {
        shouldFail = false
      } else {
        // Default to probably_fail behavior
        const prob = job.fail_probability !== null && job.fail_probability !== undefined ? job.fail_probability : 0.3
        shouldFail = Math.random() < prob
      }

      if (shouldFail) {
        throw new Error('SIMULATED_FAILURE: Custom processing error occurred.')
      }

      // Perform fake task for 5 seconds (as requested by user)
      await new Promise(resolve => setTimeout(resolve, 5000))

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
        
        let nextRunAt: Date | null = null
        if (canRetry) {
          const delay = this.calculateBackoff(job.attempts)
          nextRunAt = new Date(Date.now() + delay)
          console.log(`🔄 Job ${jobId} failed. Retrying in ${delay / 1000}s (at ${nextRunAt.toISOString()})`)
          
          // Add to Redis delayed queue
          await queueService.enqueueDelayedJob(queueName, jobId, job.priority, nextRunAt.getTime())
        }

        // Update job status in DB
        await query(
          `UPDATE jobs 
           SET status = $1, 
               last_error = $2, 
               updated_at = NOW(), 
               failed_at = $3,
               run_at = COALESCE($4, run_at)
           WHERE id = $5`,
          [newStatus, errorMessage, canRetry ? null : new Date(), nextRunAt, jobId]
        )

        // Update attempt log
        if (attemptId) {
          await query(
            'UPDATE job_attempts SET status = \'failed\', error = $1, finished_at = NOW() WHERE id = $2',
            [errorMessage, attemptId]
          )
        }

        if (!canRetry) {
          console.log(`💀 Job ${jobId} failed after ${job.attempts} attempts.`)
        }
      }
    }
  }
}
