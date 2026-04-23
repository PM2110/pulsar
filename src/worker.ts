import { env } from './config/env.config.js'
import { connectRedis } from './config/redis.config.js'
import { pool } from './config/db.config.js'
import { workerService } from './services/worker.service.js'

async function start() {
  console.log(`📡 Worker process starting in ${env.NODE_ENV} mode...`)

  try {
    // Connect to external services
    await connectRedis()

    // Start the worker loop
    // You can pass a specific queue name here if needed
    workerService.start("notifications")

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down worker gracefully...`)

      workerService.stop()

      // Close database pool
      await pool.end()
      console.log('Database pool closed')

      // Exit process
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

  } catch (err) {
    console.error('Failed to start worker:', err)
    process.exit(1)
  }
}

start()
