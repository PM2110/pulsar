-- Migration: 005_add_outbox_table.sql
-- Create the outbox table for transactional side effects

-- Transactional Outbox Pattern Table
-- This table stores side-effects that must be executed after a database transaction succeeds.
-- For Pulsar, this primarily means enqueuing job IDs into Redis.
-- By storing these in the same DB transaction as the job creation, we ensure atomicity.

CREATE TABLE IF NOT EXISTS outbox (
    id SERIAL PRIMARY KEY,
    
    -- The type of event (e.g., 'job_enqueue')
    event_type VARCHAR(255) NOT NULL,
    
    -- JSON payload containing data needed for the relay (e.g., job_id, queue_name)
    payload JSONB NOT NULL,
    
    -- Status lifecycle: pending -> processed | failed
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Tracks persistent failures for optional manual intervention
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for the relay worker to efficiently find pending entries
CREATE INDEX IF NOT EXISTS idx_outbox_status_pending ON outbox (status) WHERE status = 'pending';

-- Index for searching specific events if needed
CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON outbox (event_type);
