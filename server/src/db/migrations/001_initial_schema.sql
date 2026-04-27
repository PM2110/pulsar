-- Initial schema for jobs table

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,

  queue_name VARCHAR(100) NOT NULL,
  job_type VARCHAR(100) NOT NULL,

  payload JSONB NOT NULL,

  status VARCHAR(30) NOT NULL DEFAULT 'pending',

  priority INT NOT NULL DEFAULT 0 CHECK (priority >= 0),

  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),

  run_at TIMESTAMP NOT NULL DEFAULT NOW(),

  locked_by VARCHAR(100),
  locked_at TIMESTAMP,

  last_error TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  completed_at TIMESTAMP,
  failed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at ON jobs (status, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_queue_name ON jobs (queue_name);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs (priority DESC);

-- Job attempts table
CREATE TABLE IF NOT EXISTS job_attempts (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  
  attempt_number INT NOT NULL,
  status VARCHAR(30) NOT NULL,
  
  worker_id VARCHAR(100),
  
  error TEXT,
  
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for job_attempts
CREATE INDEX IF NOT EXISTS idx_job_attempts_job_id ON job_attempts (job_id);
