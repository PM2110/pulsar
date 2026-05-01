import { DEFAULT_QUEUE } from '../config/queue.config.js'
import { queueService } from './queue.service.js'
import { outboxService } from './outbox.service.js'

/**
 * Service to handle periodic promotion of delayed jobs to the main queue.
 */
export const schedulerService = {
  isRunning: false,
  lastReaperRun: 0,

  /**
   * Starts the polling background scheduler loop.
   * @param queueName Target queue to process.
   */
  async start(queueName: string = DEFAULT_QUEUE) {
    if (this.isRunning) return
    this.isRunning = true
    console.log(`⏰ Redis Scheduler started for queue: ${queueName}`)
    
    while (this.isRunning) {
      try {
        // 1. Process Outbox Relay (High Frequency - every loop/1s)
        await outboxService.relayPendingEntries()

        // 2. Run Job Reaper (Low Frequency - every 5 mins) to catch "starved" jobs
        const now = Date.now()
        if (now - this.lastReaperRun > 300000) {
          await queueService.reSyncPendingJobs(queueName)
          this.lastReaperRun = now
        }

        // 3. Promote ready jobs and get wait time until next job
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
   * Gracefully aborts the background scheduler execution sequence.
   */
  stop() {
    this.isRunning = false
    console.log('🛑 Scheduler stopping...')
  }
}
