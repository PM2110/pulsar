import { env } from './config/env.config.js'
import { connectRedis, redisClient } from './config/redis.config.js'
import { pool } from './config/db.config.js'
import { workerService } from './services/worker.service.js'
import { workerRegistry } from './services/worker.registry.js'
import os from 'os'

const start = async () => {
  console.log(`📡 Worker process starting in ${env.NODE_ENV} mode...`)

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
          console.error('❌ Error handling concurrency update:', err)
        }
      })

      await subClient.subscribe('pulsar:worker_control', async (message) => {
        try {
          const { action, worker_id } = JSON.parse(message)
          if (worker_id === uniqueWorkerId) {
            if (action === 'stop') {
              console.log(`🛑 Received stop signal via PubSub for worker ${worker_id}`)
              workerService.stop()
            } else if (action === 'start') {
              console.log(`🚀 Received start signal via PubSub for worker ${worker_id}`)
              workerService.start(env.QUEUE_NAME, uniqueWorkerId)
            } else if (action === 'crash') {
              console.log(`☠ Received crash signal via PubSub for worker ${worker_id}. Simulating crash by pausing worker loop instead of exiting, so UI Start button works.`)
              workerService.stop()
            }
          }
        } catch (err) {
          console.error('❌ Error handling worker control event:', err)
        }
      })

      // Start the main worker loop (blocks)
      await workerService.start(env.QUEUE_NAME, uniqueWorkerId)
    }

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`)

      if (processType === 'worker' || processType === 'both') {
        workerService.stopInstance(uniqueWorkerId)
        await workerRegistry.setStopped(uniqueWorkerId)
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
