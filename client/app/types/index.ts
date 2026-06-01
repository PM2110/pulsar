export interface Job {
  id: string;
  queue_name: string;
  job_type: string;
  payload: any;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  failure_mode: string;
  fail_probability: number | null;
  last_error: string | null;
  run_at: string;
  created_at: string;
  completed_at: string | null;
  failed_at: string | null;
}

export interface JobAttempt {
  id: string;
  business_attempt: number;
  infra_attempt: number;
  status: string;
  worker_id: string;
  started_at: string;
  finished_at: string | null;
  execution_time_ms: number | null;
  queue_latency_ms: number | null;
  error: string | null;
}

export interface EnrichedJobAttempt {
  id: string;
  job_id: string;
  business_attempt: number;
  infra_attempt: number;
  status: string;
  worker_id: string;
  error: string | null;
  stack_trace: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
  scheduled_at: string | null;
  worker_hostname: string | null;
  worker_pid: number | null;
  queue_latency_ms: number | null;
  execution_time_ms: number | null;
  job_type: string;
  queue_name: string;
  payload: any;
}

export interface WorkerInfo {
  worker_id: string;
  queue_name: string;
  status: "idle" | "processing" | "stopped";
  concurrency: number;
  active_job_ids: string[];
  jobs_processed: number;
  jobs_failed: number;
  auto_restart: boolean;
  adaptive_scaling?: boolean;
  restart_at?: string;
  last_activity: string;
  started_at: string;
  current_job_id: string | null;
}
