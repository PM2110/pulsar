import { app } from './app.js'
import { env } from './config/env.config.js'
import { connectRedis } from './config/redis.config.js'
import { pool } from './config/db.config.js'

async function start() {
  const port = parseInt(env.PORT, 10) || 3000

  try {
    // Connect to external services
    await connectRedis()
    
    const server = app.listen(port, () => {
      console.log(`🚀 Server listening on port ${port} in ${env.NODE_ENV} mode`)
    })

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`)
      
      server.close(async () => {
        console.log('HTTP server closed')
        
        // Close database pool
        await pool.end()
        console.log('Database pool closed')
        
        // Close Redis
        // await redisClient.quit() // client will close on process exit or can be handled here
        
        process.exit(0)
      })

      // Force close after 10s
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))

  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()
