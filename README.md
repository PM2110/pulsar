# ⚡ Pulsar – Distributed Job Engine & Real-Time Dashboard

Pulsar is a high-performance, distributed background job engine built with **Node.js, Express, PostgreSQL, and Redis**. It is designed to reliably process deferred tasks, manage retries, and track job lifecycles.

Coupled with a **Next.js** frontend, Pulsar offers a stunning, real-time dashboard for comprehensive observability into queue health, worker status, and job progression.

![Pulsar Dashboard Configuration](client/public/favicon.ico) <!-- Placeholder for actual screenshots if available -->

## 🌟 What is this project all about?

In modern web applications, executing heavy, long-running, or failure-prone tasks (like sending emails, transcoding videos, or generating reports) directly in the HTTP request cycle leads to poor user experiences and timeouts. 

**Pulsar solves this by deferring work to background workers.** 
- **The API** accepts jobs and enqueues them in Redis using priority queues.
- **The Workers** (which can be distributed horizontally) efficiently pop jobs off the queue using blocking operations (`BZPOPMIN`) to guarantee low latency.
- **The Dashboard** consumes Server-Sent Events (SSE) to update status transitions (pending ➞ processing ➞ completed/failed) in real time.

## 🚀 Key Features

*   **Robust State Management:** All jobs are durably persisted in **PostgreSQL**.
*   **High-Speed Queueing:** Uses **Redis** Sorted Sets to route jobs intelligently by queue name and priority score.
*   **Built-in Retry & Failure Handling:** Probabilistic failure modes, dead-letter logic, and strict attempt limits configurable per job.
*   **Real-time Observability:** A beautiful dark-themed Next.js dashboard showing live activity feeds via **SSE (Server-Sent Events)**.
*   **Worker Control:** Dynamically spawn or stop workers directly from the frontend UI.
*   **Dockerized:** A fully containerized microservice architecture ready for staging/production deployment out of the box.

## 🏗 System Architecture

Pulsar is composed of three main layers:
1.  **Frontend (`/client`)**: Next.js (React), Tailwind CSS, Axios. Provides the visual interface.
2.  **API Server (`/server`)**: Node.js, Express, TypeORM/pg. Exposes REST endpoints to create jobs, seed test data, and stream SSE events.
3.  **Workers (`/server/src/worker.ts`)**: Standalone Node.js processes that pull jobs from Redis, execute them, and report results back to PostgreSQL.

## 📦 Quick Start (using Docker)

The fastest and most reliable way to run the entire Pulsar stack (Frontend, API, Workers, DB, Cache) is using Docker Compose.

### Prerequisites
- Docker and Docker Compose installed.

### Setup Steps
```bash
# 1. Provide environment configurations
cp server/.env.example server/.env.development

# 2. Start the comprehensive stack in detached mode
docker compose up -d --build

# 3. Apply database schemas
docker exec -i pulsar-app-1 pnpm db:migrate

# 4. Seed initial mock jobs (Optional but recommended to test the UI)
docker exec -i pulsar-app-1 pnpm seed:jobs
```

Once running, you can access the services:
- **🖥 Interactive Dashboard**: [http://localhost:3001](http://localhost:3001)
- **🔌 Backend API**: [http://localhost:3000](http://localhost:3000)

## 📖 Deep Dive Documentation

Detailed documentation on the core engine internals:

- 🏗 **[Architecture Overview](./server/docs/architecture.md)**: Deep dive into the system design, queue routing, and scaling.
- 🔗 **[API Reference](./server/docs/api_reference.md)**: Details on REST endpoints for jobs, stats, and workers.
- 💾 **[Database Schema](./server/docs/database_schema.md)**: Entity Relationship Diagrams (ERD) and table descriptions.
- ⚙️ **[Worker Module](./server/docs/worker_module.md)**: How jobs are dequeued, processed, and lifecycle transitions.
- 🛠 **[Development Workflow](./server/docs/development.md)**: Local Node.js development, migrations, and adding new job types.

## 💻 Tech Stack Summary

*   **Runtime:** Node.js v22+
*   **Frontend:** Next.js (React 19), TailwindCSS 4
*   **Backend:** Express v5, TypeScript
*   **Database:** PostgreSQL 16 (Relational state & history)
*   **Message Broker:** Redis 7 (In-memory priority queues) 
*   **Validation:** Zod

---
*Built to bring joy and reliability to distributed task processing.*
