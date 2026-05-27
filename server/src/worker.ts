import { env } from './config/env.config.js'
import { connectRedis, redisClient } from './config/redis.config.js'
import { pool } from './config/db.config.js'
import { workerService } from './services/worker.service.js'
import { workerRegistry } from './services/worker.registry.js'
import { logger } from './utils/logger.js'
import os from 'os'

const start = async () => {
  logger.info(`Worker process starting in ${env.NODE_ENV} mode...`, 'WORKER')

  try {
    // Connect to external services
    await connectRedis()

    // Start the appropriate service(s)
    const processType = env.PROCESS_TYPE
    
    // Generate a unique worker ID using the provided ID and short hostname suffix
    const hostname = os.hostname().slice(0, 8)
    const uniqueWorkerId = `${env.WORKER_ID}-${hostname}`

    if (processType === 'scheduler' || processType === 'both') {
      const { schedulerService } = await import('./services/scheduler.service.js')
      schedulerService.start(env.QUEUE_NAME)
    }

    if (processType === 'worker' || processType === 'both') {
      // Dynamic Concurrency & Control Subscriber
      const subClient = redisClient.duplicate()
      await subClient.connect()
      
      await subClient.subscribe('pulsar:concurrency_update', async (message) => {
        try {
          const { queue_name, concurrency } = JSON.parse(message)
          await workerService.handleConcurrencyUpdate(queue_name, concurrency)
        } catch (err) {
          logger.error('Error handling concurrency update', err, 'WORKER')
        }
      })

      await subClient.subscribe('pulsar:worker_control', async (message) => {
        try {
          const { action, worker_id } = JSON.parse(message)
          if (worker_id === uniqueWorkerId) {
            if (action === 'stop') {
              logger.info(`Received stop signal via PubSub for worker ${worker_id}`, 'WORKER')
              // Stop both the singleton loop and the named instance (clears heartbeat immediately)
              workerService.stop()
              workerService.stopInstance(uniqueWorkerId)
            } else if (action === 'start') {
              logger.info(`Received start signal via PubSub for worker ${worker_id}`, 'WORKER')
              // Use startInstance() — it tracks heartbeats per worker ID and avoids singleton flag collisions
              workerService.startInstance(env.QUEUE_NAME, uniqueWorkerId)
            } else if (action === 'crash') {
              logger.warn(`Received crash signal via PubSub for worker ${worker_id}. Simulating crash.`, 'WORKER')
              workerService.stop()
              workerService.crashInstance(uniqueWorkerId)
            }
          }
        } catch (err) {
          logger.error('Error handling worker control event', err, 'WORKER')
        }
      })

      // Start the main worker loop (blocks)
      await workerService.start(env.QUEUE_NAME, uniqueWorkerId)
    }

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`, 'WORKER')

      if (processType === 'worker' || processType === 'both') {
        workerService.stopInstance(uniqueWorkerId)
        await workerRegistry.unregister(uniqueWorkerId)
      }
      
      if (processType === 'scheduler' || processType === 'both') {
        const { schedulerService } = await import('./services/scheduler.service.js')
        schedulerService.stop()
      }

      // Close database pool
      await pool.end()
      logger.info('Database pool closed', 'DATABASE')

      // Exit process
      process.exit(0)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

  } catch (err) {
    logger.error('Failed to start worker', err, 'WORKER')
    process.exit(1)
  }
}

start()
