# Architecture Overview

Pulsar follows a **Layered Architecture** pattern to ensure separation of concerns and maintainability.

## Directory Structure

```text
src/
├── config/       # Environment, Database, and Redis configurations
├── controllers/  # Request handlers (logic)
├── db/           # Migrations and SQL schemas
├── middlewares/  # Express middlewares (Error handling, etc.)
├── routes/       # API Route definitions
├── services/     # Business logic (Queue, Worker)
├── types/        # Zod validation schemas and TS interfaces
├── app.ts        # Express app initialization
├── server.ts     # Server entry point
└── worker.ts     # Worker entry point
```

## Core Components

### 1. Unified Configuration (`src/config/`)
Environment variables are validated using **Zod** in `env.config.ts`. If a required variable is missing, the app will fail fast on startup.

### 2. Database & Migrations (`src/db/`)
We use a simple SQL-based migration system. The `src/db/migrate.ts` script executes all `.sql` files in the `src/db/migrations/` directory in alphanumeric order. 

### 3. Request Flow
1. **Routing**: `src/routes/` defines the path and passes control to a controller.
2. **Validation**: Controllers use **Zod schemas** from `src/types/` to validate `req.body`.
3. **Logic/Persistence**: Controllers interact with the PostgreSQL pool (`src/config/db.config.ts`) to persist data.
4. **Queueing**:
   - If a job is immediate, it is added directly to the Redis Priority Queue.
   - If a job is scheduled for the future, it is added to the **Redis Delayed Queue**.
5. **Error Handling**: Any errors are caught and passed via `next(err)` to the global `errorHandler` middleware.

### 4. Background Job Engine
Pulsar uses a hybrid Redis/PostgreSQL approach:
- **Redis Priority Queue**: A Sorted Set (`queue:<name>`) where scores represent priority and timestamp. Workers poll this using blocking `bzPopMin`.
- **Redis Delayed Queue**: A Sorted Set (`delayed:queue:<name>`) for jobs waiting for their `run_at` time (including exponential backoff retries).
- **Scheduler**: A lightweight process within the worker that "promotes" jobs from the Delayed Queue to the Priority Queue when they are due.
- **PostgreSQL**: The source of truth for job metadata, history, and status tracking.

## Deployment Model
The application is fully Dockerized using a multi-stage `Dockerfile`:
- **Development**: Uses volumes for hot-reloading. The `app` service uses `tsx watch`, and the `worker` service runs compiled code from `dist/` (requires `pnpm build` on the host or a restart).
- **Production**: Optimized runtime image containing only production dependencies and compiled code.
