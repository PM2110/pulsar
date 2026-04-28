import { env } from './config/env.config.js'
import { connectRedis } from './config/redis.config.js'
import { pool } from './config/db.config.js'
import { workerService } from './services/worker.service.js'

const start = async () => {
  console.log(`📡 Worker process starting in ${env.NODE_ENV} mode...`)

  try {
    // Connect to external services
    await connectRedis()

    // Start the appropriate service(s)
    const processType = env.PROCESS_TYPE
    
    if (processType === 'scheduler' || processType === 'both') {
      const { schedulerService } = await import('./services/scheduler.service.js')
      schedulerService.start(env.QUEUE_NAME)
    }

    if (processType === 'worker' || processType === 'both') {
      workerService.start(env.QUEUE_NAME, env.WORKER_ID)
    }

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`)

      if (processType === 'worker' || processType === 'both') {
        workerService.stop()
      }
      
      if (processType === 'scheduler' || processType === 'both') {
        const { schedulerService } = await import('./services/scheduler.service.js')
        schedulerService.stop()
      }

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
