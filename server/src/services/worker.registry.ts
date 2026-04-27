/**
 * In-memory registry that tracks all active worker instances.
 * Workers register themselves here and update their heartbeats.
 */

export interface WorkerInfo {
  worker_id: string
  queue_name: string
  status: 'idle' | 'processing' | 'stopped'
  jobs_processed: number
  jobs_failed: number
  last_activity: Date
  started_at: Date
  current_job_id?: string | null
}

class WorkerRegistry {
  private workers: Map<string, WorkerInfo> = new Map()

  register(workerId: string, queueName: string): void {
    this.workers.set(workerId, {
      worker_id: workerId,
      queue_name: queueName,
      status: 'idle',
      jobs_processed: 0,
      jobs_failed: 0,
      last_activity: new Date(),
      started_at: new Date(),
      current_job_id: null
    })
  }

  unregister(workerId: string): void {
    this.workers.delete(workerId)
  }

  setProcessing(workerId: string, jobId: string): void {
    const w = this.workers.get(workerId)
    if (w) {
      w.status = 'processing'
      w.current_job_id = jobId
      w.last_activity = new Date()
    }
  }

  setIdle(workerId: string): void {
    const w = this.workers.get(workerId)
    if (w) {
      w.status = 'idle'
      w.current_job_id = null
      w.last_activity = new Date()
    }
  }

  setStopped(workerId: string): void {
    const w = this.workers.get(workerId)
    if (w) {
      w.status = 'stopped'
      w.current_job_id = null
      w.last_activity = new Date()
    }
  }

  incrementProcessed(workerId: string): void {
    const w = this.workers.get(workerId)
    if (w) w.jobs_processed++
  }

  incrementFailed(workerId: string): void {
    const w = this.workers.get(workerId)
    if (w) w.jobs_failed++
  }

  get(workerId: string): WorkerInfo | undefined {
    return this.workers.get(workerId)
  }

  getAll(): WorkerInfo[] {
    return Array.from(this.workers.values())
  }

  has(workerId: string): boolean {
    return this.workers.has(workerId)
  }
}

export const workerRegistry = new WorkerRegistry()
