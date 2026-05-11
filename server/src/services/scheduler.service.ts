import { DEFAULT_QUEUE } from '../config/queue.config.js'
import { queueService } from './queue.service.js'
import { outboxService } from './outbox.service.js'

/**
 * Service to handle periodic promotion of delayed jobs to the main queue.
 */
export const schedulerService = {
  isRunning: false,
  lastReaperRun: 0,
  lastAgingRun: 0,
  lastRecoveryRun: 0,

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
        // Checks the 'outbox' table for pending entries and enqueues them in Redis.
        // This runs every ~1s to ensure low-latency job ingestion.
        await outboxService.relayPendingEntries()

        // 2. Run Job Reaper (Low Frequency - every 5 mins) to catch "starved" jobs
        // Secondary consistency mechanism that scans for jobs 'stuck' in pending state.
        // Acts as a fallback if both the immediate enqueue AND the outbox relay fail.
        const now = Date.now()
        if (now - this.lastReaperRun > 300000) {
          await queueService.reSyncPendingJobs(queueName)
          this.lastReaperRun = now
        }

        // 3. Run Priority Aging (Queue Fairness - every 30s)
        // Boosts jobs that have been waiting too long to prevent starvation.
        if (now - this.lastAgingRun > 30000) {
          await queueService.applyPriorityAging(queueName)
          this.lastAgingRun = now
        }
        
        // 4. Run Crash Recovery and Precise Restarts
        // We run the restart check every loop (~1s) for high precision, 
        // but the full stale recovery check only every 15s.
        const { workerRegistry } = await import('./worker.registry.js')
        const doFullStaleCheck = (now - this.lastRecoveryRun > 15000)
        await workerRegistry.recoverStaleWorkers(queueService, !doFullStaleCheck)
        
        if (doFullStaleCheck) {
          this.lastRecoveryRun = now
        }

        // 4. Promote ready jobs and get wait time until next job
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
