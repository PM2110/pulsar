import { redisClient } from '../config/redis.config.js'
import { workerRegistry } from './worker.registry.js'
import { workerService } from './worker.service.js'
import { logger } from '../utils/logger.js'
import { randomBytes } from 'crypto'

export interface AutoscalerConfig {
  enabled: boolean
  minWorkers: number
  maxWorkers: number
  threshold: number
}

class AutoscalerService {
  private config: Map<string, AutoscalerConfig> = new Map()
  private isRunning: boolean = false
  private intervalId: NodeJS.Timeout | null = null

  constructor() {
    // Default configurations for known queues
    this.config.set('notifications', { enabled: true, minWorkers: 1, maxWorkers: 5, threshold: 5 })
    this.config.set('media', { enabled: true, minWorkers: 1, maxWorkers: 5, threshold: 5 })
    this.config.set('default', { enabled: true, minWorkers: 1, maxWorkers: 5, threshold: 5 })
  }

  getConfig(): Record<string, AutoscalerConfig> {
    const res: Record<string, AutoscalerConfig> = {}
    for (const [queue, conf] of this.config.entries()) {
      res[queue] = conf
    }
    return res
  }

  setConfig(queueName: string, newConfig: Partial<AutoscalerConfig>): AutoscalerConfig {
    const existing = this.config.get(queueName) || { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 }
    const updated = { ...existing, ...newConfig }
    this.config.set(queueName, updated)
    return updated
  }

  start(intervalMs: number = 5000) {
    if (this.isRunning) return
    this.isRunning = true
    this.intervalId = setInterval(() => this.tick(), intervalMs)
    logger.info(`Autoscaler started (interval: ${intervalMs}ms)`, 'AUTOSCALER')
  }

  stop() {
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    logger.info(`Autoscaler stopped`, 'AUTOSCALER')
  }

  private async tick() {
    for (const [queueName, conf] of this.config.entries()) {
      if (!conf.enabled) continue

      try {
        const queueDepth = await redisClient.zCard(`queue:${queueName}`)

        // Count active workers for this queue
        const allWorkers = await workerRegistry.getAll()
        const activeWorkersForQueue = allWorkers.filter(w => w.queue_name === queueName && w.status !== 'stopped')
        const activeCount = activeWorkersForQueue.length

        // Separate auto-scaled workers vs manual-scaled workers
        const scalingWorkers = activeWorkersForQueue.filter(w => w.adaptive_scaling)
        const fixedWorkers = activeWorkersForQueue.filter(w => !w.adaptive_scaling)

        // Nothing to scale if no adaptive workers are running
        if (scalingWorkers.length === 0) {
          logger.info(`Autoscaler [${queueName}]: Depth=${queueDepth}, ActiveWorkers=${activeCount} (No adaptive workers)`, 'AUTOSCALER')
          continue
        }

        // Calculate target TOTAL concurrency for the queue
        // e.g. if depth is 20 and threshold is 5, we want 4 slots total.
        let targetTotalConcurrency = Math.ceil(queueDepth / conf.threshold)

        // Clamp between min and max (these now represent total slots for the queue)
        targetTotalConcurrency = Math.max(conf.minWorkers, Math.min(conf.maxWorkers, targetTotalConcurrency))

        // Subtract the slots already occupied by fixed workers
        const fixedConcurrencySum = fixedWorkers.reduce((acc, w) => acc + (w.concurrency || 1), 0)
        const remainingTarget = Math.max(0, targetTotalConcurrency - fixedConcurrencySum)

        if (scalingWorkers.length > 0) {
          const concurrencyPerWorker = Math.ceil(remainingTarget / scalingWorkers.length)

          logger.info(`Autoscaler [${queueName}]: Depth=${queueDepth}, ActiveWorkers=${activeCount} (Scaling=${scalingWorkers.length}, Fixed=${fixedWorkers.length}), TargetTotal=${targetTotalConcurrency}, Remaining=${remainingTarget}, PerWorker=${concurrencyPerWorker}`, 'AUTOSCALER')

          // Broadcast the new concurrency target for this queue
          redisClient.publish('pulsar:concurrency_update', JSON.stringify({
            queue_name: queueName,
            concurrency: concurrencyPerWorker
          }))
        } else {
          logger.info(`Autoscaler [${queueName}]: Depth=${queueDepth}, ActiveWorkers=${activeCount} (All Fixed), TargetTotal=${targetTotalConcurrency}`, 'AUTOSCALER')
        }
      } catch (err) {
        logger.error(`Autoscaler error on queue '${queueName}'`, err, 'AUTOSCALER')
      }
    }
  }
}

export const autoscalerService = new AutoscalerService()
