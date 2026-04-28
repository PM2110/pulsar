import { WorkerInfo } from '../types/worker.types.js'

const workers: Map<string, WorkerInfo> = new Map()

/**
 * Tracks the in-memory state and heartbeat of all active Pulsar workers.
 */
export const workerRegistry = {
  /**
   * Registers a new worker node in the system.
   * @param workerId Unique identifier of the worker.
   * @param queueName The queue this worker is polling.
   */
  register: (workerId: string, queueName: string): void => {
    workers.set(workerId, {
      worker_id: workerId,
      queue_name: queueName,
      status: 'idle',
      jobs_processed: 0,
      jobs_failed: 0,
      last_activity: new Date(),
      started_at: new Date(),
      current_job_id: null
    })
  },

  /**
   * Completely removes a worker from the tracked registry.
   * @param workerId ID of the worker to remove.
   */
  unregister: (workerId: string): void => {
    workers.delete(workerId)
  },

  /**
   * Updates a worker's status to processing and links it to an active job.
   * @param workerId ID of the active processing worker.
   * @param jobId ID of the job being processed.
   */
  setProcessing: (workerId: string, jobId: string): void => {
    const w = workers.get(workerId)
    if (w) {
      w.status = 'processing'
      w.current_job_id = jobId
      w.last_activity = new Date()
    }
  },

  /**
   * Reverts a worker's status to idle when awaiting jobs.
   * @param workerId ID of the idle worker.
   */
  setIdle: (workerId: string): void => {
    const w = workers.get(workerId)
    if (w) {
      w.status = 'idle'
      w.current_job_id = null
      w.last_activity = new Date()
    }
  },

  /**
   * Marks a worker as gracefully stopped.
   * @param workerId ID of the stopped worker.
   */
  setStopped: (workerId: string): void => {
    const w = workers.get(workerId)
    if (w) {
      w.status = 'stopped'
      w.current_job_id = null
      w.last_activity = new Date()
    }
  },

  /**
   * Increments the success processing counter for a worker.
   * @param workerId ID of the respective worker.
   */
  incrementProcessed: (workerId: string): void => {
    const w = workers.get(workerId)
    if (w) w.jobs_processed++
  },

  /**
   * Increments the failure processing counter for a worker.
   * @param workerId ID of the respective worker.
   */
  incrementFailed: (workerId: string): void => {
    const w = workers.get(workerId)
    if (w) w.jobs_failed++
  },

  /**
   * Retrieves specific state information about a worker.
   * @param workerId ID of the worker.
   * @returns Worker statistics or undefined.
   */
  get: (workerId: string): WorkerInfo | undefined => {
    return workers.get(workerId)
  },

  /**
   * Retrieves the comprehensive list of all known workers.
   * @returns Array of WorkerInfo payloads.
   */
  getAll: (): WorkerInfo[] => {
    return Array.from(workers.values())
  },

  /**
   * Validates if a worker is present in the registry.
   * @param workerId ID of the worker.
   * @returns boolean presence indicator.
   */
  has: (workerId: string): boolean => {
    return workers.has(workerId)
  }
}
