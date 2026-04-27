-- Enrich job_attempts table with production-grade monitoring columns
ALTER TABLE job_attempts
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS stack_trace TEXT,
ADD COLUMN IF NOT EXISTS worker_hostname VARCHAR(100),
ADD COLUMN IF NOT EXISTS worker_pid INT;

-- Add comments for documentation
COMMENT ON COLUMN job_attempts.scheduled_at IS 'The time the job was intended to run';
COMMENT ON COLUMN job_attempts.stack_trace IS 'Full error stack trace if the attempt failed';
COMMENT ON COLUMN job_attempts.worker_hostname IS 'Hostname of the machine where the worker is running';
COMMENT ON COLUMN job_attempts.worker_pid IS 'Process ID of the worker';
