# Database Schema

Pulsar uses PostgreSQL as its primary persistent store.

## Tables

### `jobs`
Stores the metadata and status of every background task.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | | Primary Key |
| `queue_name` | `VARCHAR` | | Name of the queue (e.g. `notifications`) |
| `job_type` | `VARCHAR` | | Type of the job (e.g. `email_send`) |
| `payload` | `JSONB` | | Job data |
| `status` | `VARCHAR` | `'pending'`| `pending`, `running`, `completed`, `failed` |
| `priority` | `INT` | `0` | Order of execution |
| `attempts` | `INT` | `0` | Current number of attempts |
| `max_attempts`| `INT` | `3` | Maximum retry limit |
| `run_at` | `TIMESTAMP` | `NOW()` | Scheduled execution time |
| `locked_by` | `VARCHAR` | | Worker ID currently processing the job |
| `locked_at` | `TIMESTAMP` | | When the job was last locked |
| `last_error` | `TEXT` | | Error message from last failed attempt |
| `created_at` | `TIMESTAMP` | `NOW()` | Record creation time |
| `updated_at` | `TIMESTAMP` | `NOW()` | Last update time |
| `completed_at`| `TIMESTAMP` | | When the job finished successfully |
| `failed_at` | `TIMESTAMP` | | When the job exceeded max attempts |
| `failure_mode` | `VARCHAR` | `'probably_fail'`| `succeed`, `fail`, `probably_fail` |
| `fail_probability`| `FLOAT` | `0.3` | Custom failure rate for testing/demo |

### `job_attempts`
Records the history of every execution attempt for a job.

| Column | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | | Primary Key |
| `job_id` | `BIGINT` | | Foreign Key to `jobs.id` |
| `attempt_number`| `INT` | | 1, 2, 3... |
| `status` | `VARCHAR` | | Result of this attempt |
| `worker_id` | `VARCHAR` | | ID of the worker that processed it |
| `error` | `TEXT` | | Any error returned |
| `started_at` | `TIMESTAMP` | `NOW()` | Start time |
| `finished_at` | `TIMESTAMP` | | End time |

## Indexes
- `idx_jobs_status_run_at`: Optimized for fetching pending jobs due to run.
- `idx_jobs_queue_name`: Optimized for queue-specific filtering.
- `idx_jobs_priority`: Optimized for prioritized fetching.
- `idx_job_attempts_job_id`: Optimized for fetching history of a specific job.
