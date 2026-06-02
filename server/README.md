# Pulsar API Server and Workers

This is the core engine of **Pulsar**. It handles job orchestration, database management, and the worker lifecycle.

---

## Structure

- `src/app.ts`: Express application setup and WebSocket server.
- `src/server.ts`: Entry point for the API server.
- `src/worker.ts`: Entry point for the worker process.
- `src/services/`: Core business logic (Queue, Outbox, Scheduler, etc.).
- `src/controllers/`: Request handlers for REST endpoints.

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Installation
```bash
# Install dependencies
pnpm install

# Run migrations (Prisma)
npx prisma migrate dev

# Start in development mode
pnpm dev
```

### Environment Variables
Copy `.env.example` to `.env` and configure your database and Redis connections.

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/pulsar"
REDIS_URL="redis://localhost:6379"
PORT=3000
```

---

## Key Services

### Outbox Service
Implements the Transactional Outbox Pattern to ensure reliable job creation.

### Scheduler Service
The relay that picks up pending outbox entries and promotes them to the Redis queue.

### Worker Service
Manages the lifecycle of background tasks, handling retries, timeouts, and status updates.

### Autoscaler Service
Dynamically adjusts worker concurrency based on queue depth.

---

## Learn More

For detailed documentation on the backend components, see:
- **[Architecture Overview](../docs/architecture.md)**
- **[Worker System Deep Dive](../docs/worker-system.md)**
- **[Outbox Pattern](../docs/outbox-pattern.md)**
- **[API Reference](../docs/api-reference.md)**
- **[Business vs. Infrastructure Attempts](../docs/business-vs-infra-attempts.md)**
- **[Attempt Lifecycle Flow](../docs/attempt-lifecycle-flow.md)**
- **[Crash Recovery Mechanism](../docs/crash-recovery-mechanism.md)**
- **[Autoscaling and Concurrency](../docs/autoscaling-architecture.md)**
- **[Worker Lifecycle](../docs/worker-lifecycle.md)**
- **[Real-time Pub/Sub Pipeline](../docs/realtime-pubsub-pipeline.md)**
- **[Concurrency, Locking and Idempotency](../docs/concurrency-locking-idempotency.md)**
- **[Stuck Job Recovery and Reaper](../docs/job-reaper-and-stuck-recovery.md)**
