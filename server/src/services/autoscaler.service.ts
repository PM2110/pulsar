import { redisClient } from '../config/redis.config.js'
import { workerRegistry } from './worker.registry.js'
import { workerService } from './worker.service.js'
import { randomBytes } from 'crypto'

import { AutoscalerConfig } from '../types/worker.types.js'

const config: Map<string, AutoscalerConfig> = new Map([
  ['notifications', { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 }],
  ['media', { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 }],
  ['default', { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 }]
])

let isRunning: boolean = false
let intervalId: NodeJS.Timeout | null = null

const tick = async () => {
  for (const [queueName, conf] of config.entries()) {
    if (!conf.enabled) continue

    try {
      const queueDepth = await redisClient.zCard(`queue:${queueName}`)
      
      const allWorkers = workerRegistry.getAll()
      const activeWorkersForQueue = allWorkers.filter(w => w.queue_name === queueName && w.status !== 'stopped')
      const activeCount = activeWorkersForQueue.length

      if (activeCount < conf.maxWorkers) {
        if (activeCount < conf.minWorkers || queueDepth > (activeCount * conf.threshold)) {
          const workerId = `worker-${queueName}-${randomBytes(4).toString('hex')}`
          console.log(`📈 Auto-scaling UP: Queue '${queueName}' has ${queueDepth} jobs, ${activeCount} workers. Starting new worker '${workerId}'.`)
          workerService.startInstance(queueName, workerId)
        }
      }

      if (activeCount > conf.minWorkers && queueDepth === 0) {
        const idleWorker = activeWorkersForQueue.find(w => w.status === 'idle')
        if (idleWorker) {
          console.log(`📉 Auto-scaling DOWN: Queue '${queueName}' has 0 jobs, ${activeCount} workers. Stopping worker '${idleWorker.worker_id}'.`)
          workerService.stopInstance(idleWorker.worker_id)
          workerRegistry.setStopped(idleWorker.worker_id)
        }
      }
    } catch (err) {
      console.error(`❌ Autoscaler error on queue '${queueName}':`, err)
    }
  }
}

/**
 * Service executing background auto-scaling logic dynamically tracking queue depths via Redis.
 */
export const autoscalerService = {
  /**
   * Iterates through memory mapping yielding current queue scale configurations.
   * @returns Current active configuration settings for auto-scaling queues.
   */
  getConfig: (): Record<string, AutoscalerConfig> => {
    const res: Record<string, AutoscalerConfig> = {}
    for (const [queue, conf] of config.entries()) {
      res[queue] = conf
    }
    return res
  },

  /**
   * Patches configuration parameters dictating how a designated queue autoscales operations.
   * @param queueName Queue to modify (i.e. 'notifications')
   * @param newConfig Specific partial parameters like modifying the 'threshold' limit map.
   * @returns Confirmed patched subset configuration block.
   */
  setConfig: (queueName: string, newConfig: Partial<AutoscalerConfig>): AutoscalerConfig => {
    const existing = config.get(queueName) || { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 }
    const updated = { ...existing, ...newConfig }
    config.set(queueName, updated)
    return updated
  },

  /**
   * Initializes the scheduled polling cadence for the auto-scaling interval ticking process.
   * @param intervalMs Optional interval duration override. Default is 5s.
   */
  start: (intervalMs: number = 5000) => {
    if (isRunning) return
    isRunning = true
    intervalId = setInterval(() => tick(), intervalMs)
    console.log(`📈 Autoscaler started (interval: ${intervalMs}ms)`)
  },

  /**
   * Stops the background interval process cleanly.
   */
  stop: () => {
    isRunning = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    console.log(`🛑 Autoscaler stopped`)
  }
}
