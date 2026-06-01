-- Migration: 008_add_infra_attempts.sql
-- Adds columns to track infrastructure failures (e.g. worker crashes) separately from application-level attempts.

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS infra_attempts INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_infra_attempts INT NOT NULL DEFAULT 3;

COMMENT ON COLUMN jobs.infra_attempts IS 'Number of infrastructure-level failures (e.g. worker crashes) encountered during processing';
COMMENT ON COLUMN jobs.max_infra_attempts IS 'Maximum allowed infrastructure-level failures before marking the job as failed';
