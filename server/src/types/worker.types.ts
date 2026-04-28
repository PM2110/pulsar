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

export interface AutoscalerConfig {
  enabled: boolean
  minWorkers: number
  maxWorkers: number
  threshold: number
}
