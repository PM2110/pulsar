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

        // Count active workers for this queue (Processing or Idle, not Stopped)
        const allWorkers = workerRegistry.getAll()
        const activeWorkersForQueue = allWorkers.filter(w => w.queue_name === queueName && w.status !== 'stopped')
        const activeCount = activeWorkersForQueue.length

        // Scale Up Logic
        if (activeCount < conf.maxWorkers) {
          if (activeCount < conf.minWorkers || queueDepth > (activeCount * conf.threshold)) {
            const workerId = `worker-${queueName}-${randomBytes(4).toString('hex')}`
            console.log(`📈 Auto-scaling UP: Queue '${queueName}' has ${queueDepth} jobs, ${activeCount} workers. Starting new worker '${workerId}'.`)
            workerService.startInstance(queueName, workerId)
          }
        }

        // Scale Down Logic
        if (activeCount > conf.minWorkers && queueDepth === 0) {
          // Find an idle worker to stop
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
}

export const autoscalerService = new AutoscalerService()
