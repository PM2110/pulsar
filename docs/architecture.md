# Architecture Overview

Pulsar is a high-performance job engine designed for reliable, prioritized background processing. It uses a hybrid architecture leveraging **PostgreSQL** for persistence and **Redis** for high-frequency queueing.

## High-Level Architecture

```mermaid
graph TD
    User([User/API Client]) --> Express[Express API Server]
    Express --> PG[(PostgreSQL)]
    Express --> Redis[(Redis Queue)]
    
    subgraph "Background Processing"
        Relay[Outbox Relay] --> PG
        Relay --> Redis
        Worker[Worker Pool] --> Redis
        Worker --> PG
        Scaler[Autoscaler] --> Redis
        Scaler --> Worker
    end
```

## Directory Structure

```text
pulsar/
├── client/           # Next.js Dashboard Frontend
├── server/           # Express.js Backend & Workers
│   ├── src/
│   │   ├── config/   # Infrastructure Connections
│   │   ├── controllers/ # Request Handlers
│   │   ├── services/ # Business Logic (Outbox, Queue, etc.)
│   │   └── worker.ts # Worker Entry Point
├── docs/             # Central Documentation
└── docker-compose.yml
```

## Core Patterns

### 1. Transactional Outbox
Ensures atomicity between database updates and external side-effects (Redis enqueues).

```mermaid
sequenceDiagram
    participant App as Application Logic
    participant DB as PostgreSQL
    participant OB as Outbox Table
    participant Relay as Outbox Relay
    participant Redis as Redis Queue

    App->>DB: Start Transaction
    App->>DB: Save Job Record
    App->>OB: Save side-effect (enqueue)
    App->>DB: Commit Transaction
    
    Relay->>OB: Poll Pending
    Relay->>Redis: Enqueue Job
    Relay->>OB: Mark Processed
```

### 2. Priority Queueing
Jobs are ranked in Redis Sorted Sets using a score calculated from priority and timestamp.

```mermaid
sequenceDiagram
    participant Worker as Worker Instance
    participant Redis as Redis Priority Queue
    participant DB as PostgreSQL

    Worker->>Redis: BZPOPMIN (Lowest Score)
    Redis-->>Worker: Job ID
    Worker->>DB: Update Status: processing
    Note over Worker: Execute Task
    Worker->>DB: Update Status: completed
```

## Scalability & Reliability
- **Horizontal Scaling**: Workers can be scaled independently using Docker.
- **Autoscaling**: A built-in service monitors queue depths and spawns/terminates concurrent worker threads.
- **Resilience**: Failed jobs use **Exponential Backoff** and are stored in a **Delayed Queue** until ready for retry.
- **Reaper**: A secondary fallback process that ensures no job remains "stale" in a pending state forever.
