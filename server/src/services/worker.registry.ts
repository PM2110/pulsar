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
  register: async (workerId: string, queueName: string): Promise<void> => {
    const existing = await workerRegistry.get(workerId)
    const info = {
      worker_id: workerId,
      queue_name: queueName,
      status: existing?.status || 'idle',
      concurrency: existing?.concurrency || 1,
      active_job_ids: existing?.active_job_ids || [],
      jobs_processed: existing?.jobs_processed || 0,
      jobs_failed: existing?.jobs_failed || 0,
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
    if (w) {
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
    if (w) {
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
  setStopped: async (workerId: string): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
      w.status = 'stopped'
      w.active_job_ids = []
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Updates the concurrency (job slots) for a worker in the registry.
   */
  updateConcurrency: async (workerId: string, concurrency: number): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
      w.concurrency = concurrency
      w.last_activity = new Date()
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Increments the success processing counter for a worker.
   */
  incrementProcessed: async (workerId: string): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
      w.jobs_processed++
      await redisClient.hSet(REGISTRY_KEY, workerId, JSON.stringify(w))
    }
  },

  /**
   * Increments the failure processing counter for a worker.
   */
  incrementFailed: async (workerId: string): Promise<void> => {
    const w = await workerRegistry.get(workerId)
    if (w) {
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
    return JSON.parse(data)
  },

  /**
   * Retrieves the comprehensive list of all non-stale workers.
   */
  getAll: async (): Promise<WorkerInfo[]> => {
    const all = await redisClient.hGetAll(REGISTRY_KEY)
    const now = new Date().getTime()
    const workers: WorkerInfo[] = []
    
    for (const id in all) {
      const w: WorkerInfo = JSON.parse(all[id])
      const lastActivity = new Date(w.last_activity).getTime()
      
      // Filter out workers that haven't heartbeated in WORKER_TTL seconds
      if (now - lastActivity < WORKER_TTL * 1000) {
        workers.push(w)
      } else {
         // Cleanup stale workers asynchronously
         redisClient.hDel(REGISTRY_KEY, id)
      }
    }
    return workers
  },

  /**
   * Returns true if worker ID exists and is active.
   */
  has: async (workerId: string): Promise<boolean> => {
    const w = await workerRegistry.get(workerId)
    return !!w
  }
}
