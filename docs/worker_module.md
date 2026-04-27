# Worker Module Documentation

The Worker Module is responsible for processing background jobs enqueued by the Pulsar API. It operates independently of the main API server, allowing for asynchronous task execution and horizontal scaling.

## ⚙️ How It Works

### 1. Job Polling (Blocking Pop)
The worker uses the Redis `BZPOPMIN` command to poll for jobs. Unlike standard polling, a blocking pop waits for an item to become available in the Sorted Set for a specified timeout (default: 5 seconds). This minimizes CPU usage and provides near-instantaneous job pickup.

### 2. Priority Logic
Jobs are stored in Redis **Sorted Sets**. The priority is handled by the `score` calculated during enqueuing:
- **Score Formula**: `(10 - priority) * 10^13 + timestamp`
- Higher priority jobs (e.g., 10) get a lower score (closer to current timestamp).
- Lower priority jobs (e.g., 0) get a much higher score.
- The worker uses `BZPOPMIN` which always picks the element with the **lowest score** first.

### 3. Job Lifecycle
When a worker picks up a job:
1. **Status Update**: The job status in PostgreSQL is updated from `pending` to `processing`.
2. **Execution Simulation**: The worker performs the task logic. (Current version uses a simulated 5-second delay).
3. **Outcome Control**: The worker checks the job's `failure_mode`:
   - `succeed`: Always succeeds.
   - `fail`: Always fails.
   - `probably_fail`: Fails based on `fail_probability` (default: 0.3).
4. **Completion/Retry**: 
   - **On Success**: Status updated to `completed`.
   - **On Failure**: 
     - If `attempts < max_attempts`: Status remains `pending`, and an **Exponential Backoff** is calculated (`5s * 2^(attempts-1)`). The job's `run_at` is updated in the DB, and it is added to the **Redis Delayed Queue**.
     - If no attempts left: Status updated to `failed`.

### 4. Scheduler & Delayed Queue
To prevent queue starvation from failing jobs, Pulsar uses a two-stage queueing system:
- **Redis Delayed Queue**: Jobs waiting for their `run_at` time are stored in `delayed:queue:<name>`.
- **Scheduler**: A background process in the worker monitors the delayed set. When a job is due, it promotes it to the main Priority Queue. It uses "smart sleep" logic to minimize latency by waking up exactly when the next job is due.

## 🚀 Running the Worker

### In Docker
The worker runs as a dedicated service defined in `docker-compose.yml`.
```bash
docker logs pulsar-worker-1 -f
```

### Locally
You can run a worker instance on your host machine:
```bash
pnpm worker
```
*Note: Ensure your `.env.development` points to `localhost` for Redis and DB if running outside Docker.*

## 🧪 Testing & Simulation

Pulsar provides tools to simulate complex failure scenarios, ensuring the system can handle errors and retries gracefully.

### Failure Modes
The worker behavior for a specific job is controlled by the `failure_mode` and `fail_probability` columns:

- **`succeed`**: The job will always process successfully.
- **`fail`**: The job will always return an error, triggering retries until `max_attempts` is reached, then moving to `failed` status.
- **`probably_fail`**: The job will fail randomly based on the `fail_probability` (0.0 to 1.0).

### Seeding Test Data
Use the seeding script to populate the database with a variety of these scenarios:

```bash
# Docker
docker exec -i pulsar-app-1 pnpm seed:jobs

# Host
pnpm seed:jobs:dev
```

The seeder creates 10 jobs (5 for `notifications`, 5 for `media`) with a mix of high-priority and low-priority items and various failure modes. This is ideal for verifying:
1. **Priority Ordering**: Observe that high-priority jobs are picked up first.
2. **Exponential Backoff**: Observe wait times increasing after each failure.
3. **Dead Letter Handling**: Verify jobs eventually move to `failed` after exhausting retries.
