# Pulsar Job Engine

Pulsar is a robust, high-performance background job engine designed for Node.js environments. It ensures atomic job creation using the **Transactional Outbox Pattern** and provides a real-time dashboard for monitoring and control.

## 🚀 Quick Start (Docker)

```bash
docker compose up -d --build
```
- **Dashboard**: `http://localhost:3001`
- **API Server**: `http://localhost:3000`

## 📖 Documentation

Dive into the details of how Pulsar works:

- **[Architecture Overview](docs/architecture.md)**: Explore the system design and core patterns like the Transactional Outbox.
- **[Development Guide](docs/development-guide.md)**: Setup instructions, local execution, migrations, and seeding.
- **[API Reference](docs/api-reference.md)**: Detailed documentation of all available REST endpoints.
- **[Database Schema](docs/database-schema.md)**: PostgreSQ table definitions and indexing strategy.
- **[Worker System](docs/worker-system.md)**: Deep dive into job polling, priority logic, and autoscaling.
- **[Transactional Outbox Pattern](docs/outbox-pattern.md)**: Specific technical details on how we ensure atomicity.

## Core Features
- **Reliable Atomicity**: Never lose a job between DB and Redis.
- **Priority Queueing**: Native support for prioritized task execution.
- **Exponential Backoff**: Automatic retries with increasing delays.
- **Live Monitoring**: Real-time stats and worker telemetry via WebSockets.
- **Dynamic Scaling**: Automatic worker thread management based on queue depth.
