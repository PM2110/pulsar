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
├── types/        # Zod validation schemas and TS interfaces
├── app.ts        # Express app initialization
└── server.ts     # Server entry point & lifecycle management
```

## Core Components

### 1. Unified Configuration (`src/config/`)
Environment variables are validated using **Zod** in `env.config.ts`. If a required variable is missing, the app will fail fast on startup.

### 2. Database & Migrations (`src/db/`)
We use a simple SQL-based migration system. On startup, `server.ts` calls `runMigrations()` which applies `src/db/migrations/001_initial_schema.sql`. Tables use `IF NOT EXISTS` for safe re-runs.

### 3. Request Flow
1. **Routing**: `src/routes/` defines the path and passes control to a controller.
2. **Validation**: Controllers use **Zod schemas** from `src/types/` to validate `req.body`.
3. **Logic/Persistence**: Controllers interact with the PostgreSQL pool (`src/config/db.config.ts`) to persist data.
4. **Error Handling**: Any errors are caught and passed via `next(err)` to the global `errorHandler` middleware.

### 4. Background Job Logic
- **Job Creation**: Jobs are created with a `pending` status. 
- **Queue Mapping**: In `job.controller.ts`, we determine the `queue_name` using the `QUEUE_MAP` defined in `src/config/queue.config.ts`. This allows the API to automatically categorize jobs without requiring the client to know the queue structure.

## Deployment Model
The application is fully Dockerized using a multi-stage `Dockerfile`:
- **Development**: Uses volumes for hot-reloading and includes `devDependencies` like `tsx`.
- **Production**: Optimized runtime image containing only production dependencies and compiled code.
