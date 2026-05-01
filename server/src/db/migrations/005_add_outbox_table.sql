-- Migration: 005_add_outbox_table.sql
-- Create the outbox table for transactional side effects

CREATE TABLE IF NOT EXISTS outbox (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient polling of pending entries
CREATE INDEX IF NOT EXISTS idx_outbox_status_pending ON outbox (status) WHERE status = 'pending';

-- Index for searching specific events if needed
CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON outbox (event_type);
