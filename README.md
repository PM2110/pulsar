# Pulsar - Backend Job Engine

Pulsar is a high-performance background job engine built with Node.js, Express, and PostgreSQL. It provides a robust API for creating and managing background tasks with automatic queue routing.

## 🚀 Quick Start (Docker)

The easiest way to run Pulsar is using Docker Compose.

```bash
# 1. Copy environment variables
cp .env.example .env.development

# 2. Start the stack
docker-compose up --build
```

The server will be available at `http://localhost:3000`.

## 🛠 Tech Stack

- **Runtime**: [Node.js v22+](https://nodejs.org/)
- **Framework**: [Express v5](https://expressjs.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL 16](https://www.postgresql.org/)
- **Cache**: [Redis 7](https://redis.io/)
- **Validation**: [Zod](https://zod.dev/)
- **Package Manager**: [Pnpm](https://pnpm.io/)

## 📖 Documentation

- [Architecture Overview](./docs/architecture.md) - Understand how the code is structured.
- [API Reference](./docs/api_reference.md) - Details on available endpoints.
- [Database Schema](./docs/database_schema.md) - ERD and table descriptions.
- [Development Workflow](./docs/development.md) - Migration guides and local setup.

## 📜 Key Features

- **Automated Migrations**: Tables are automatically created/updated on server start.
- **Dynamic Queue Routing**: Jobs are automatically routed to specific queues based on their type.
- **Hot Reloading**: Docker environment supports real-time code syncing for fast development.
- **Graceful Shutdown**: Handles SIGINT/SIGTERM to close DB and Redis connections cleanly.
