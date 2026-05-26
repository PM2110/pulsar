import os from 'os'
import { redisClient } from '../config/redis.config.js'
import { query } from '../config/db.config.js'
import { DEFAULT_QUEUE } from '../config/queue.config.js'
import { queueService } from './queue.service.js'
import { workerRegistry } from './worker.registry.js'
import { logger } from '../utils/logger.js'

/**
 * Service to handle worker logic: polling Redis and processing jobs.
 */
// Track running state and concurrency per worker instance
const runningInstances: Map<string, boolean> = new Map()
const instanceConcurrency: Map<string, number> = new Map()
const activeTasks: Map<string, Set<Promise<void>>> = new Map()
const workerQueues: Map<string, string> = new Map() // Tracks workerId -> queueName
const crashedInstances: Set<string> = new Set()
const heartbeats: Map<string, NodeJS.Timeout> = new Map() // Tracks heartbeat intervals per workerId

export const workerService = {
  isRunning: false,
  singletonHeartbeat: null as NodeJS.Timeout | null,

  /**
   * Starts the singleton worker loop (used by Docker workers).
   */
  async start(queueName: string = DEFAULT_QUEUE, workerId: string = 'worker-1') {
    if (this.isRunning) return
    this.isRunning = true
    instanceConcurrency.set(workerId, 1)
    workerQueues.set(workerId, queueName)
    activeTasks.set(workerId, new Set())

    await workerRegistry.register(workerId, queueName)
    logger.info(`Worker started polling queue: ${queueName} with concurrency: 1`, 'WORKER')

    // Heartbeat to keep registration alive in Redis
    this.singletonHeartbeat = setInterval(() => workerRegistry.register(workerId, queueName), 10000)

    while (this.isRunning) {
      try {
        const concurrency = instanceConcurrency.get(workerId) || 1
        const tasks = activeTasks.get(workerId)!

        if (tasks.size < concurrency) {
          const taskPromise = this.pollAndProcess(queueName, workerId)
          tasks.add(taskPromise)
          taskPromise.finally(() => tasks.delete(taskPromise))
        } else {
          // At capacity, wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        logger.error('Worker loop error', error, 'WORKER')
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    if (this.singletonHeartbeat) {
      clearInterval(this.singletonHeartbeat)
      this.singletonHeartbeat = null
    }
    await workerRegistry.setStopped(workerId)
  },

  /**
   * Starts a named worker instance (used by /api/workers/start).
   */
  async startInstance(queueName: string, workerId: string) {
    if (runningInstances.get(workerId)) {
      logger.warn(`Worker instance '${workerId}' is already running. Ignoring duplicate start.`, 'WORKER')
      return
    }
    runningInstances.set(workerId, true)
    crashedInstances.delete(workerId) // Reset crash state
    instanceConcurrency.set(workerId, 1)
    workerQueues.set(workerId, queueName)
    activeTasks.set(workerId, new Set())

    await workerRegistry.register(workerId, queueName)
    logger.info(`Worker instance '${workerId}' started on queue: ${queueName} with concurrency: 1`, 'WORKER')

    const heartbeat = setInterval(() => workerRegistry.register(workerId, queueName), 10000)
    heartbeats.set(workerId, heartbeat)

    while (runningInstances.get(workerId)) {
      try {
        const concurrency = instanceConcurrency.get(workerId) || 1
        const tasks = activeTasks.get(workerId)!

        if (tasks.size < concurrency) {
          const taskPromise = this.pollAndProcess(queueName, workerId)
          tasks.add(taskPromise)
          taskPromise.finally(() => tasks.delete(taskPromise))
        } else {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        logger.error(`Worker instance '${workerId}' error`, error, 'WORKER')
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    clearInterval(heartbeat)

    // Skip registry cleanup if this was an intentional "crash"
    if (!crashedInstances.has(workerId)) {
      await workerRegistry.setStopped(workerId)
      logger.info(`Worker instance '${workerId}' stopped gracefully.`, 'WORKER')
    } else {
      logger.info(`Worker instance '${workerId}' exited silently (Simulation).`, 'WORKER')
    }
    
    workerQueues.delete(workerId)
  },

  /**
   * Dynamically updates the concurrency for a specific worker instance.
   */
  async updateConcurrency(workerId: string, concurrency: number) {
    logger.info(`Updating concurrency for worker '${workerId}' to ${concurrency}`, 'WORKER')
    instanceConcurrency.set(workerId, concurrency)
    await workerRegistry.updateConcurrency(workerId, concurrency)
  },

  /**
   * Batch updates all local workers belonging to a queue when an autoscaling update arrives.
   */
  async handleConcurrencyUpdate(queueName: string, concurrency: number) {
    for (const [workerId, q] of workerQueues.entries()) {
      if (q === queueName) {
        const info = await workerRegistry.get(workerId)
        if (info && info.adaptive_scaling) {
          await this.updateConcurrency(workerId, concurrency)
        }
      }
    }
  },

  /**
   * Stops a named worker instance.
   */
  stopInstance(workerId: string) {
    runningInstances.set(workerId, false)
    // Clear the heartbeat immediately so it stops re-registering the worker in Redis
    const hb = heartbeats.get(workerId)
    if (hb) {
      clearInterval(hb)
      heartbeats.delete(workerId)
    }
    logger.info(`Worker instance '${workerId}' stopping...`, 'WORKER')
  },

  /**
   * Simulates a worker crash by stopping the loop without cleaning up the registry.
   */
  crashInstance(workerId: string) {
    crashedInstances.add(workerId)
    runningInstances.set(workerId, false)
    // Clear the heartbeat immediately so it stops re-registering the worker in Redis
    const hb = heartbeats.get(workerId)
    if (hb) {
      clearInterval(hb)
      heartbeats.delete(workerId)
    }
    logger.warn(`Worker instance '${workerId}' crashing...`, 'WORKER')
  },

  /**
   * Stops the worker loop and clears singleton heartbeat.
   */
  stop() {
    this.isRunning = false
    if (this.singletonHeartbeat) {
      clearInterval(this.singletonHeartbeat)
      this.singletonHeartbeat = null
    }
    logger.info('Worker stopping...', 'WORKER')
  },

  /**
   * Calculates exponential backoff delay with random jitter:
   * (5s * 2^(attempts-1)) + random jitter (0-500ms)
   */
  calculateBackoff(attempts: number): number {
    const baseDelay = 5000 // 5 seconds
    const exponentialDelay = baseDelay * Math.pow(2, attempts - 1)
    const jitter = Math.floor(Math.random() * 500) // 0-500ms jitter
    return exponentialDelay + jitter
  },

  /**
   * Polls Redis for a job using blocking pop and processes it if found.
   */
  async pollAndProcess(queueName: string, workerId: string) {
    const redisKey = `queue:${queueName}`

    // Use non-blocking zPopMin to avoid locking the connection for other concurrent slots
    const result = await redisClient.zPopMin(redisKey)
    
    // Safety check: if the worker was stopped while waiting for Redis, bail out immediately
    if (!this.isRunning && !runningInstances.get(workerId)) return

    if (!result) {
      // Small sleep to avoid tight loop on empty queue
      await new Promise(resolve => setTimeout(resolve, 500))
      return
    }

    const jobId = result.value
    logger.info(`Picked up job ${jobId} from ${queueName}`, 'WORKER')

    // Track in registry
    await workerRegistry.setProcessing(workerId, jobId)

    let job: any
    let attemptId: string | number | undefined
    const startedAt = new Date()

    try {
      // Fetch job from DB, increment attempts and update status to 'processing'
      // Strict Concurrency Control:
      // 1. Only update if status is 'pending'
      // 2. Only update if run_at is in the past (prevents early starts)
      const startResult = await query(
        `UPDATE jobs 
         SET status = 'processing', 
             attempts = attempts + 1, 
             updated_at = NOW() 
         WHERE id = $1 
           AND status = 'pending' 
           AND run_at <= NOW() 
         RETURNING *`,
        [jobId]
      )

      if (startResult.rows.length === 0) {
        // If update failed, check if it was due to an early start
        const checkResult = await query('SELECT status, run_at, priority FROM jobs WHERE id = $1', [jobId])

        if (checkResult.rows.length > 0) {
          const { status, run_at, priority } = checkResult.rows[0]
          const runAtDate = new Date(run_at)

          if (status === 'pending' && runAtDate > new Date()) {
            logger.warn(`Job ${jobId} picked up early (Scheduled for ${run_at}). Re-scheduling in delayed queue.`, 'WORKER')
            await queueService.enqueueDelayedJob(queueName, jobId, priority, runAtDate.getTime())
          } else {
            logger.warn(`Job ${jobId} skipped: Status is '${status}' or already being processed.`, 'WORKER')
          }
        } else {
          logger.warn(`Job ${jobId} found in Redis but not in DB. Skipping.`, 'WORKER')
        }
        return
      }

      job = startResult.rows[0]
      logger.info(`Processing job ${jobId} (Type: ${job.job_type}, Attempt: ${job.attempts}/${job.max_attempts})`, 'JOB')

      // Broadcast start using Redis PubSub
      redisClient.publish('pulsar:events', JSON.stringify({ type: 'job_update', job_id: jobId, status: 'processing' }))

      // Update registry
      workerRegistry.setProcessing(workerId, jobId)

      // Calculate Latency
      const scheduledAt = new Date(job.run_at)
      const queueLatencyMs = startedAt.getTime() - scheduledAt.getTime()

      // Log attempt start in job_attempts
      const attemptResult = await query(
        `INSERT INTO job_attempts (
          job_id, 
          attempt_number, 
          status, 
          worker_id, 
          started_at, 
          scheduled_at, 
          worker_hostname, 
          worker_pid,
          queue_latency_ms
        )
         VALUES ($1, $2, 'processing', $3, $4, $5, $6, $7, $8) RETURNING id`,
        [jobId, job.attempts, workerId, startedAt, scheduledAt, os.hostname(), process.pid, queueLatencyMs]
      )
      attemptId = attemptResult.rows[0].id

      // Determine if the job should fail
      let shouldFail = false
      if (job.failure_mode === 'fail') {
        shouldFail = true
      } else if (job.failure_mode === 'succeed') {
        shouldFail = false
      } else {
        const prob = job.fail_probability !== null && job.fail_probability !== undefined ? job.fail_probability : 0.3
        shouldFail = Math.random() < prob
      }

      // Simulated Processing Delay: 3-10 Seconds
      const processingDelay = Math.floor(Math.random() * 7000) + 3000
      await new Promise(resolve => setTimeout(resolve, processingDelay))

      // Final safety check: don't update registry if we've been crashed during simulation
      if (!this.isRunning && !runningInstances.get(workerId)) {
        logger.warn(`Worker ${workerId} was crashed during processing. Aborting registry update.`, 'WORKER')
        return
      }

      if (shouldFail) {
        throw new Error('SIMULATED_FAILURE: Custom processing error occurred.')
      }

      const finishedAt = new Date()
      const executionTimeMs = finishedAt.getTime() - startedAt.getTime()

      // Mark as complete
      await query(
        'UPDATE jobs SET status = \'completed\', completed_at = NOW(), updated_at = NOW() WHERE id = $1',
        [jobId]
      )

      // Update attempt log
      await query(
        'UPDATE job_attempts SET status = \'completed\', finished_at = $1, execution_time_ms = $2 WHERE id = $3',
        [finishedAt, executionTimeMs, attemptId]
      )
      
      await workerRegistry.incrementProcessed(workerId)
      await workerRegistry.setIdle(workerId, jobId)
      logger.info(`Job ${jobId} completed successfully - SUCCESS - ${executionTimeMs}ms (Latency: ${queueLatencyMs}ms)`, 'JOB')

      // Broadcast completion
      redisClient.publish('pulsar:events', JSON.stringify({ type: 'job_update', job_id: jobId, status: 'completed' }))
    } catch (error: any) {
      logger.error(`Failed to process job ${jobId}`, error, 'JOB')
      const finishedAt = new Date()
      const executionTimeMs = finishedAt.getTime() - startedAt.getTime()
      const errorMessage = error.message || 'Unknown error'

      if (job) {
        const canRetry = job.attempts < job.max_attempts
        const newStatus = canRetry ? 'pending' : 'failed'

        let nextRunAt: Date | null = null
        if (canRetry) {
          const delay = this.calculateBackoff(job.attempts)
          nextRunAt = new Date(Date.now() + delay)
          logger.info(`Job ${jobId} failed - RETRYING in ${delay / 1000}s (at ${nextRunAt.toISOString()})`, 'JOB')

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
            `UPDATE job_attempts 
             SET status = 'failed', 
                 error = $1, 
                 stack_trace = $2, 
                 finished_at = $3,
                 execution_time_ms = $4
             WHERE id = $5`,
            [errorMessage, error.stack || null, finishedAt, executionTimeMs, attemptId]
          )
        }

        if (!canRetry) {
          workerRegistry.incrementFailed(workerId)
          logger.error(`Job ${jobId} failed permanently after ${job.attempts} attempts`, null, 'JOB')
        }

        // Broadcast failure or retry
        redisClient.publish('pulsar:events', JSON.stringify({ type: 'job_update', job_id: jobId, status: newStatus, error: errorMessage }))
      }
      await workerRegistry.incrementFailed(workerId)
      await workerRegistry.setIdle(workerId, jobId)
    }
  }
}
