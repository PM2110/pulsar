-- Add failure_mode and fail_probability columns to jobs table
ALTER TABLE jobs 
ADD COLUMN failure_mode VARCHAR(20) DEFAULT 'probably_fail',
ADD COLUMN fail_probability DOUBLE PRECISION DEFAULT 0.3;
