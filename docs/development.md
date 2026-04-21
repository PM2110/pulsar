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

## Database Migrations
Migrations are automatically run on app startup (see `src/server.ts`). 
To manually trigger a migration:
```bash
pnpm db:migrate
```

To add a new migration:
1. Create a new SQL file in `src/db/migrations/`.
2. Update `src/db/migrate.ts` to include the new file in the execution sequence.

## Code Standards
- **Validation**: Always use Zod schemas in `src/types/` for input validation.
- **Errors**: Always use the global error handler by passing errors to `next(err)` in controllers.
- **Imports**: This project uses ESM. Always include the `.js` extension in your relative imports (e.g., `import { foo } from './foo.js'`).
