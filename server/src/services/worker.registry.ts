import { redisClient } from '../config/redis.config.js'
import { WorkerInfo } from '../types/worker.types.js'

const REGISTRY_KEY = 'pulsar:workers'
const WORKER_TTL = 30 // Seconds before a worker is considered stale

/**
 * Tracks the distributed state and heartbeat of all active Pulsar workers using Redis.
 */
export const workerRegistry = {
  /**
   * Registers or updates a worker node in the shared Redis registry.
   */
  register: async (workerId: string, queueName: string, autoRestart: boolean = false, force: boolean = false): Promise<void> => {
    const existing = await workerRegistry.get(workerId)
    
    // If it was explicitly stopped, only allow registration if "force" is true (manual start).
    // This prevents "ghost" heartbeats from dying processes from resurrecting the node.
    if (existing?.status === 'stopped' && !force) return

    // Try to get settings from database, otherwise persist defaults
    let dbAutoRestart = autoRestart
    let dbAdaptiveScaling = true

    try {
      const { query } = await import('../config/db.config.js')
      const result = await query('SELECT auto_restart, adaptive_scaling FROM worker_settings WHERE worker_id = $1', [workerId])
      if (result.rows.length > 0) {
        dbAutoRestart = result.rows[0].auto_restart
        dbAdaptiveScaling = result.rows[0].adaptive_scaling
      } else {
        // Insert default setting
        await query(
          'INSERT INTO worker_settings (worker_id, auto_restart, adaptive_scaling) VALUES ($1, $2, $3) ON CONFLICT (worker_id) DO NOTHING',
          [workerId, dbAutoRestart, dbAdaptiveScaling]
        )
      }
    } catch (err) {
      console.error('Error fetching/setting db worker settings in register:', err)
    }

    const info = {
      worker_id: workerId,
      queue_name: queueName,
      status: force ? 'idle' : (existing?.status || 'idle'),
      concurrency: existing?.concurrency || 1,
      active_job_ids: existing?.active_job_ids || [],
      jobs_processed: existing?.jobs_processed || 0,
      jobs_failed: existing?.jobs_failed || 0,
      auto_restart: dbAutoRestart,
      adaptive_scaling: dbAdaptiveScaling,
      last_activity: new Date(),
      started_at: existing?.started_at || new Date()
    }

    await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(info))
  },

  /**
   * Completely removes a worker from the shared registry.
   */
  unregister: async (workerId: string): Promise<void> => {
    await redisClient.hDel(REGISTRY_KEY, workerId)
  },

  /**
   * Updates a worker's status to processing and links it to an active job.
   */
  setProcessing: async (workerId: string, jobId: string): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w && w.status !== 'stopped') {
      w.status = 'processing'
      if (!w.active_job_ids.includes(jobId)) {
        w.active_job_ids.push(jobId)
      }
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Reverts a worker's status to idle when awaiting jobs.
   */
  setIdle: async (workerId: string, jobId?: string): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w && w.status !== 'stopped') {
      if (jobId) {
        w.active_job_ids = w.active_job_ids.filter(id => id !== jobId)
      } else {
        w.active_job_ids = []
      }

      if (w.active_job_ids.length === 0) {
        w.status = 'idle'
      }
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Marks a worker as gracefully stopped.
   */
  setStopped: async (workerId: string, autoRestart?: boolean): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
      w.status = 'stopped'
      w.active_job_ids = []
      if (autoRestart !== undefined) {
        w.auto_restart = autoRestart
        // Persist to DB as well
        try {
          const { query } = await import('../config/db.config.js')
          await query(
            'INSERT INTO worker_settings (worker_id, auto_restart) VALUES ($1, $2) ON CONFLICT (worker_id) DO UPDATE SET auto_restart = EXCLUDED.auto_restart, updated_at = NOW()',
            [workerId, autoRestart]
          )
        } catch (err) {
          console.error('Error updating auto_restart in db in setStopped:', err)
        }
      }
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Schedules a worker restart at a specific time.
   */
  setRestartAt: async (workerId: string, restartAt: Date): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
      w.status = 'stopped'
      w.restart_at = restartAt
      w.auto_restart = true
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
    try {
      const { query } = await import('../config/db.config.js')
      await query(
        'INSERT INTO worker_settings (worker_id, auto_restart) VALUES ($1, TRUE) ON CONFLICT (worker_id) DO UPDATE SET auto_restart = TRUE, updated_at = NOW()',
        [workerId]
      )
    } catch (err) {
      console.error('Error setting auto_restart in db in setRestartAt:', err)
    }
  },

  /**
   * Updates the concurrency (job slots) for a worker in the registry.
   */
  updateConcurrency: async (workerId: string, concurrency: number): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w && w.status !== 'stopped') {
      w.concurrency = concurrency
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Updates the auto_restart setting in registry and DB.
   */
  updateAutoRestart: async (workerId: string, autoRestart: boolean): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
      w.auto_restart = autoRestart
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
    try {
      const { query } = await import('../config/db.config.js')
      await query(
        'INSERT INTO worker_settings (worker_id, auto_restart) VALUES ($1, $2) ON CONFLICT (worker_id) DO UPDATE SET auto_restart = EXCLUDED.auto_restart, updated_at = NOW()',
        [workerId, autoRestart]
      )
    } catch (err) {
      console.error('Error updating auto_restart in DB:', err)
    }
  },

  /**
   * Updates the adaptive_scaling setting in registry and DB.
   */
  updateAdaptiveScaling: async (workerId: string, enabled: boolean): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
      w.adaptive_scaling = enabled
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
    try {
      const { query } = await import('../config/db.config.js')
      await query(
        'INSERT INTO worker_settings (worker_id, adaptive_scaling) VALUES ($1, $2) ON CONFLICT (worker_id) DO UPDATE SET adaptive_scaling = EXCLUDED.adaptive_scaling, updated_at = NOW()',
        [workerId, enabled]
      )
    } catch (err) {
      console.error('Error updating adaptive_scaling in DB:', err)
    }
  },

  /**
   * Increments the success processing counter for a worker.
   */
  incrementProcessed: async (workerId: string): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w && w.status !== 'stopped') {
      w.jobs_processed++
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Increments the failure processing counter for a worker.
   */
  incrementFailed: async (workerId: string): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w && w.status !== 'stopped') {
      w.jobs_failed++
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Retrieves specific state information about a worker from Redis.
   */
  get: async (workerId: string): Promise<WorkerInfo | undefined> => {
    const data = await redisClient.hGet(REGISTRY_KEY, workerId)
    if (!data) return undefined
    const w = JSON.parse(data)
    if (w && w.adaptive_scaling === undefined) {
      w.adaptive_scaling = true
    }
    return w
  },

  /**
   * Retrieves the comprehensive list of all non-stale workers.
   */
  getAll: async (): Promise<WorkerInfo[]> => {
    const all = await redisClient.hGetAll(REGISTRY_KEY)
    const workers: WorkerInfo[] = []

    for (const id in all) {
      const w: WorkerInfo = JSON.parse(all[id])
      if (w.adaptive_scaling === undefined) {
        w.adaptive_scaling = true
      }
      // Return all registered workers; UI and recoverStaleWorkers handle state filtering
      workers.push(w)
    }
    return workers
  },

  /**
   * Internal logic to identify and recover jobs from stale workers.
   * Called periodically by the scheduler's Death Watch.
   */
  recoverStaleWorkers: async (queueService: any, onlyRestarts: boolean = false): Promise<number> => {
    const all = await redisClient.hGetAll(REGISTRY_KEY)
    const now = new Date().getTime()
    let recoveredCount = 0

    for (const id in all) {
      const w: WorkerInfo = JSON.parse(all[id])
      const lastActivity = new Date(w.last_activity).getTime()

      // A. Handle timed re-starts OR auto-heals for stopped workers
      if (w.status === 'stopped') {
        const restartTime = w.restart_at ? new Date(w.restart_at).getTime() : null
        const shouldRestart = (restartTime && now >= restartTime) || (w.auto_restart && !w.restart_at)

        if (shouldRestart) {
          console.log(`⏰ Restarting worker ${id} (${restartTime ? 'Scheduled' : 'Auto-Heal'})`)
          // Clear restart_at to avoid loops, set back to idle/processing if starting
          w.restart_at = undefined
          w.status = 'idle'
          w.last_activity = new Date() // Reset activity clock to give it time to boot
          await redisClient.hSet(REGISTRY_KEY, id, JSON.stringify(w))

          if (w.worker_id.startsWith('api-')) {
            // API workers are managed by the server process — use the restart channel
            redisClient.publish('pulsar:worker_restart', JSON.stringify({
              worker_id: w.worker_id,
              queue_name: w.queue_name
            }))
          } else {
            // Standalone Docker workers subscribe to pulsar:worker_control
            redisClient.publish('pulsar:worker_control', JSON.stringify({
              action: 'start',
              worker_id: w.worker_id,
              queue_name: w.queue_name
            }))
          }
          continue
        }
      }
      
      if (onlyRestarts) continue

      // B. If worker hasn't heartbeated in WORKER_TTL seconds
      if (now - lastActivity >= WORKER_TTL * 1000) {
        // Skip recovery if already intentionally stopped
        if (w.status === 'stopped') {
          // Just cleanup the entry if it's been stopped and stale for a long time (e.g. 1 hour)
          if (now - lastActivity > 3600 * 1000) {
            await redisClient.hDel(REGISTRY_KEY, id)
          }
          continue
        }

        console.log(`🕵️ Recovery: Worker ${id} is stale. Cleaning up...`)
        await workerRegistry.recoverWorker(id, queueService, w)
        recoveredCount += (w.active_job_ids?.length || 0)
      }
    }
    return recoveredCount
  },

  /**
   * Instantly executes failover logic for a worker without waiting for TTL.
   */
  recoverWorker: async (workerId: string, queueService: any, workerData?: WorkerInfo): Promise<void> => {
    const w = workerData || await workerRegistry.get(workerId)
    if (!w) return

    // 1. Recover any jobs the worker was processing
    if (w.active_job_ids && w.active_job_ids.length > 0) {
      console.log(`♻️ Recovery: Re-enqueuing ${w.active_job_ids.length} jobs from crashed worker ${workerId}`)

      for (const jobId of w.active_job_ids) {
        try {
          // Mark as pending in DB
          const { query } = await import('../config/db.config.js')

          // Check if we can retry
          const jobQuery = await query('SELECT attempts, max_attempts FROM jobs WHERE id = $1 AND status = $2', [jobId, 'processing'])
          if (jobQuery.rows.length === 0) continue

          const job = jobQuery.rows[0]
          const canRetry = job.attempts < job.max_attempts
          const newStatus = canRetry ? 'pending' : 'failed'

          await query(
            `UPDATE jobs 
             SET status = $1, 
                 updated_at = NOW(), 
                 last_error = 'Worker crash recovery triggered.'
             WHERE id = $2 AND status = 'processing'`,
            [newStatus, jobId]
          )

          // Add a failed attempt log entry for tracking
          await query(
            `INSERT INTO job_attempts (job_id, attempt_number, status, error, worker_id)
             SELECT id, attempts, 'failed', 'Worker crashed during execution', $2
             FROM jobs WHERE id = $1`,
            [jobId, workerId]
          )

          // Re-enqueue in Redis if allowed
          if (canRetry) {
            const jobResult = await query('SELECT priority FROM jobs WHERE id = $1', [jobId])
            if (jobResult.rows.length > 0) {
              await queueService.enqueueJob(w.queue_name, jobId, jobResult.rows[0].priority)
            }
          }
        } catch (err) {
          console.error(`❌ Recovery: Failed to recover job ${jobId}:`, err)
        }
      }
    }

    // 2. We preserve auto_restart setting so that the scheduler's Death Watch
    // can automatically attempt a restart in the next cycle if desired.
    // (w.auto_restart remains unchanged)

    // 3. Mark worker as "stopped" rather than completely deleting it, so users can re-start it.
    // NOTE: We do NOT update last_activity here to ensure the UI shows it as stale/disconnected.
    w.status = 'stopped'
    w.active_job_ids = []
    await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
  },

  /**
   * Returns true if worker ID exists and is active.
   */
  has: async (workerId: string): Promise<boolean> => {
    const w = await workerRegistry.get(workerId)
    return !!w
  }
}
