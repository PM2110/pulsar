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
2. **Execution**: The worker performs the task logic. (Current version uses a simulated 2-second delay).
3. **Completion**: 
   - On success: Status is updated to `completed`.
   - On failure: Status is updated to `failed`.

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

## 📈 Scaling
To handle higher volumes, you can spin up multiple worker instances. Since `BZPOPMIN` is atomic, Redis ensures that each job is picked up by exactly one worker.

In Docker Compose, you can scale the worker service:
```bash
docker compose up -d --scale worker=3
```
