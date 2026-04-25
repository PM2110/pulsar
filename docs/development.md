# Development Workflow

## Environment Variables
Environment variables are managed via `.env.{NODE_ENV}` files.
- `.env.example`: Template for new environments.
- `.env.development`: Used for local development.
- `.env.production`: Used for the production build.

## Running Locally (without Docker)
If you prefer to run services outside of Docker:
1. Ensure PostgreSQL and Redis are running on your host.
2. Update `.env.development` to use `localhost` instead of service names (`db`, `redis`).
3. Run the development server:
   ```bash
   pnpm dev
   ```
4. Run the worker:
   ```bash
   pnpm worker
   ```

## Database Migrations
Pulsar uses a file-based migration runner.
To add a new migration:
1. Create a new SQL file in `src/db/migrations/` (e.g., `002_add_columns.sql`).
2. The runner in `src/db/migrate.ts` will automatically detect and run all `.sql` files in alphanumeric order.

To run migrations:
```bash
pnpm db:migrate
```

## 🐳 Docker Tips
- **Code Sync**: The project uses volumes for hot-reloading. However, the **Worker** service runs compiled code from the `dist/` folder. 
- **Important**: After making changes to TypeScript files, you must run `pnpm build` on your host machine to update the `dist/` folder so the worker container sees the changes.
- **Restarting**: If you change `.env` files or want to force a refresh: `docker compose up -d`.

## Code Standards
- **Validation**: Always use Zod schemas in `src/types/` for input validation.
- **Errors**: Always use the global error handler by passing errors to `next(err)` in controllers.
- **Imports**: This project uses ESM. Always include the `.js` extension in your relative imports (e.g., `import { foo } from './foo.js'`).
