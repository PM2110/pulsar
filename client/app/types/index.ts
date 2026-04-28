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
  attempt_number: number;
  status: string;
  worker_id: string;
  started_at: string;
  finished_at: string | null;
  execution_time_ms: number | null;
  queue_latency_ms: number | null;
  error: string | null;
}

export interface WorkerInfo {
  worker_id: string;
  queue_name: string;
  status: "idle" | "processing" | "stopped";
  jobs_processed: number;
  jobs_failed: number;
  last_activity: string;
  started_at: string;
  current_job_id: string | null;
}
