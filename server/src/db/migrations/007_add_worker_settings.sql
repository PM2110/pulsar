-- Migration: 007_add_worker_settings.sql
-- Creates a table to persist worker-specific configurations (Auto-Healing and Adaptive Scaling toggles).

CREATE TABLE IF NOT EXISTS worker_settings (
  worker_id VARCHAR(100) PRIMARY KEY,
  auto_restart BOOLEAN NOT NULL DEFAULT TRUE,
  adaptive_scaling BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE worker_settings IS 'Persisted configurations for worker fleet nodes';
COMMENT ON COLUMN worker_settings.auto_restart IS 'Toggle for automatically restarting a worker process on failure';
COMMENT ON COLUMN worker_settings.adaptive_scaling IS 'Toggle for allowing the autoscaler to dynamically adjust the worker concurrency';
