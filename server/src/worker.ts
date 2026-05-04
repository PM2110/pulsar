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

      // Dynamic Concurrency Subscriber
      const subClient = (await import('./config/redis.config.js')).redisClient.duplicate()
      await subClient.connect()
      await subClient.subscribe('pulsar:concurrency_update', (message) => {
        try {
          const { queue_name, concurrency } = JSON.parse(message)
          if (queue_name === env.QUEUE_NAME) {
            workerService.updateConcurrency(env.WORKER_ID, concurrency)
          }
        } catch (err) {
          console.error('❌ Error handling concurrency update:', err)
        }
      })
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
