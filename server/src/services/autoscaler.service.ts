import { redisClient } from '../config/redis.config.js'
import { workerRegistry } from './worker.registry.js'
import { workerService } from './worker.service.js'
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
    this.config.set('notifications', { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 })
    this.config.set('media', { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 })
    this.config.set('default', { enabled: false, minWorkers: 1, maxWorkers: 5, threshold: 5 })
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
    console.log(`📈 Autoscaler started (interval: ${intervalMs}ms)`)
  }

  stop() {
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log(`🛑 Autoscaler stopped`)
  }

  private async tick() {
    for (const [queueName, conf] of this.config.entries()) {
      if (!conf.enabled) continue

      try {
        const queueDepth = await redisClient.zCard(`queue:${queueName}`)
        
        // Count active workers for this queue
        const allWorkers = workerRegistry.getAll()
        const activeWorkersForQueue = allWorkers.filter(w => w.queue_name === queueName && w.status !== 'stopped')
        const activeCount = activeWorkersForQueue.length

        if (activeCount === 0) continue

        // Calculate target TOTAL concurrency for the queue
        // e.g. if depth is 20 and threshold is 5, we want 4 slots total.
        let targetTotalConcurrency = Math.ceil(queueDepth / conf.threshold)
        
        // Clamp between min and max (these now represent total slots for the queue)
        targetTotalConcurrency = Math.max(conf.minWorkers, Math.min(conf.maxWorkers, targetTotalConcurrency))

        // Divide total capacity among active workers
        const concurrencyPerWorker = Math.ceil(targetTotalConcurrency / activeCount)

        console.log(`📈 Autoscaler [${queueName}]: Depth=${queueDepth}, ActiveWorkers=${activeCount}, TargetTotal=${targetTotalConcurrency}, PerWorker=${concurrencyPerWorker}`)

        // Broadcast the new concurrency target for this queue
        redisClient.publish('pulsar:concurrency_update', JSON.stringify({
          queue_name: queueName,
          concurrency: concurrencyPerWorker
        }))
      } catch (err) {
        console.error(`❌ Autoscaler error on queue '${queueName}':`, err)
      }
    }
  }
}

export const autoscalerService = new AutoscalerService()
