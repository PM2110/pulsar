-- Migration: 009_split_job_attempt_numbers.sql
-- Split attempt_number into business_attempt and infra_attempt in job_attempts table.

ALTER TABLE job_attempts
ADD COLUMN IF NOT EXISTS business_attempt INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS infra_attempt INT NOT NULL DEFAULT 0;

-- Migrate existing attempt_number values to business_attempt
UPDATE job_attempts SET business_attempt = attempt_number;

-- Now drop the old attempt_number column
ALTER TABLE job_attempts DROP COLUMN attempt_number;

-- Add comments for documentation
COMMENT ON COLUMN job_attempts.business_attempt IS 'The business attempt number of the job at the start of this execution';
COMMENT ON COLUMN job_attempts.infra_attempt IS 'The infrastructure attempt number (crashes) at the start of this execution';
