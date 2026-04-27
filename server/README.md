# Pulsar Server Operations

This directory contains the core backend API, the background workers, and the database integration for the Pulsar Job Engine.

## Directory Structure

```text
server/
├── src/
│   ├── config/       # Database, Redis, and Environment Configurations
│   ├── controllers/  # Route handlers mapping requests to services
│   ├── db/           # PostgreSQL migrations and schema setup
│   ├── middlewares/  # Security, Error Handling, Logging
│   ├── routes/       # Express route definitions
│   ├── scripts/      # Standalone utilities (e.g., job seeding)
│   ├── services/     # Core business logic (Worker, Queue management)
│   ├── types/        # Zod validation schemas and TypeScript interfaces
│   ├── app.ts        # Express app initialization
│   ├── server.ts     # Main API entry point
│   └── worker.ts     # Standalone Worker Daemon
├── docs/             # Technical deep dives on architecture and APIs
├── .env.example      # Environment parameter template
└── package.json      # PNPM dependencies and scripts
```

## Running Locally (Without Docker)

While Docker is recommended, you can run the server natively for active development:

### 1. Requirements
- Node.js 22+
- Redis running on `localhost:6379`
- PostgreSQL running on default port `5432` with a database named `pulsar_db`

### 2. Setup
```bash
# Install dependencies
pnpm install

# Setup environment 
cp .env.example .env.development
```

### 3. Migrations & Seeding
```bash
# Initialize DB tables
pnpm db:migrate:dev

# Seed realistic mock jobs
pnpm seed:jobs:dev
```

### 4. Running the Ecosystem

You need to run both the API server (to accept requests) and the Worker process (to process jobs) concurrently.

**Terminal 1 (Start the API server):**
```bash
pnpm dev
# API running on http://localhost:3000
```

**Terminal 2 (Start a generic worker):**
```bash
# By default, reads from 'default' queue unless overridden by ENV variables
pnpm worker
```

## Environment Variables
- `PORT`: API Port (default 3000)
- `DATABASE_URL`: Postgres Connection String
- `REDIS_URL`: Redis Connection String 
- `QUEUE_NAME`: Specifies which queue a started worker should consume (default: `default`)
- `WORKER_ID`: Unique identifier for the worker process

For in-depth documentation on the inner workings, please refer to the files within the `docs/` folder.
