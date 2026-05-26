export interface WorkerInfo {
  worker_id: string
  queue_name: string
  status: 'idle' | 'processing' | 'stopped'
  concurrency: number
  active_job_ids: string[]
  jobs_processed: number
  jobs_failed: number
  last_activity: Date
  auto_restart: boolean
  adaptive_scaling: boolean
  restart_at?: Date
  started_at: Date
}

export interface AutoscalerConfig {
  enabled: boolean
  minWorkers: number
  maxWorkers: number
  threshold: number
}
