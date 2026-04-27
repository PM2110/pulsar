-- Add metrics columns to track latency and execution time
ALTER TABLE job_attempts
ADD COLUMN IF NOT EXISTS queue_latency_ms BIGINT,
ADD COLUMN IF NOT EXISTS execution_time_ms BIGINT;

COMMENT ON COLUMN job_attempts.queue_latency_ms IS 'Time in milliseconds from scheduled_at to started_at';
COMMENT ON COLUMN job_attempts.execution_time_ms IS 'Time in milliseconds from started_at to finished_at';
