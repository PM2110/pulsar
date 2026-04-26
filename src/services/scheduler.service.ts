import { DEFAULT_QUEUE } from '../config/queue.config.js'
import { queueService } from './queue.service.js'

/**
 * Service to handle periodic promotion of delayed jobs to the main queue.
 */
export const schedulerService = {
  isRunning: false,

  /**
   * Starts the scheduler loop.
   */
  async start(queueName: string = DEFAULT_QUEUE) {
    if (this.isRunning) return
    this.isRunning = true
    console.log(`⏰ Redis Scheduler started for queue: ${queueName}`)
    
    while (this.isRunning) {
      try {
        // Promote ready jobs and get wait time until next job
        const nextWait = await queueService.promoteDelayedJobs(queueName)
        
        // Smart sleep: if a job is due soon, wait for it, otherwise default to 1s
        const sleepTime = nextWait !== null ? Math.min(1000, nextWait) : 1000
        
        if (nextWait !== null && nextWait < 1000) {
          console.log(`💤 Next job due in ${nextWait}ms. Sleeping...`)
        }

        await new Promise(resolve => setTimeout(resolve, sleepTime))
      } catch (error) {
        console.error('❌ Scheduler error:', error)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
  },

  /**
   * Stops the scheduler loop.
   */
  stop() {
    this.isRunning = false
    console.log('🛑 Scheduler stopping...')
  }
}
