-- Migration: 006_add_idempotency_key.sql
-- Adds an optional unique constraints for job idempotency.

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);

-- Create a unique index on idempotency_key to prevent duplicates
-- Conditional index to allow multiple NULLs if needed, but standard UNIQUE allows it anyway in PG.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN jobs.idempotency_key IS 'Optional client-provided key to ensure a job is only created once.';
