import { app } from './app.js'
import { env } from './config/env.config.js'
import { connectRedis, redisClient } from './config/redis.config.js'
import { pool } from './config/db.config.js'
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import { statsService } from './services/stats.service.js'
import { autoscalerService } from './services/autoscaler.service.js'
import { workerService } from './services/worker.service.js'
import { logger } from './utils/logger.js'

const start = async () => {
  const port = parseInt(env.PORT, 10) || 3000

  try {
    // Connect to external services
    await connectRedis()

    const httpServer = createServer(app)
    
    // Attach Socket.IO
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.NODE_ENV === 'production' ? (process.env.ALLOWED_ORIGINS?.split(',') || false) : true,
        credentials: true
      }
    })

    // Setup Redis Event Subscriber
    const pubSubClient = redisClient.duplicate()
    await pubSubClient.connect()

    await pubSubClient.subscribe('pulsar:events', async (message) => {
      try {
        const eventData = JSON.parse(message)
        io.emit('job_update', eventData)
      } catch (err) {
        logger.error('Error broadcasting websocket events', err, 'WEBSOCKET')
      }
    })

    // Securely aggregate metrics and broadcast stats on an independent loop
    // preventing Postgres DDOS spirals when high job volumes flow.
    setInterval(async () => {
      try {
        const stats = await statsService.getStats()
        io.emit('stats_update', stats)
      } catch (err) {
        logger.error('Error broadcasting stats update', err, 'STATS')
      }
    }, 2000)

    await pubSubClient.subscribe('pulsar:concurrency_update', async (message) => {
      try {
        const { queue_name, concurrency } = JSON.parse(message)
        await workerService.handleConcurrencyUpdate(queue_name, concurrency)
      } catch (err) {
        logger.error('Error handling concurrency update on server', err, 'AUTOSCALER')
      }
    })

    await pubSubClient.subscribe('pulsar:worker_restart', async (message) => {
      try {
        const { worker_id, queue_name } = JSON.parse(message)
        logger.info(`Self-Healing: Restarting API worker instance ${worker_id} on ${queue_name}`, 'HEALER')
        workerService.startInstance(queue_name, worker_id)
      } catch (err) {
        logger.error('Error during self-healing restart', err, 'HEALER')
      }
    })

    await pubSubClient.subscribe('pulsar:worker_control', async (message) => {
      try {
        const { action, worker_id } = JSON.parse(message)
        if (action === 'stop') {
          workerService.stopInstance(worker_id)
        } else if (action === 'crash') {
          workerService.crashInstance(worker_id)
        }
      } catch (err) {
        logger.error('Error handling worker control event on server', err, 'SYSTEM')
      }
    })

    // Client connection logging
    io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`, 'WEBSOCKET')
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`, 'WEBSOCKET')
      })
    })

    const server = httpServer.listen(port, () => {
      logger.info(`Server listening on port ${port} in ${env.NODE_ENV} mode`, 'SYSTEM')
    })
    
    // Start Autoscaler Service
    autoscalerService.start()

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`, 'SYSTEM')

      server.close(async () => {
        logger.info('HTTP server closed', 'SYSTEM')
        
        // Stop Autoscaler
        autoscalerService.stop()

        // Close database pool
        await pool.end()
        logger.info('Database pool closed', 'DATABASE')

        process.exit(0)
      })

      // Force close after 10s
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down', null, 'SYSTEM')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

  } catch (err) {
    logger.error('Failed to start server', err, 'SYSTEM')
    process.exit(1)
  }
}

start()
