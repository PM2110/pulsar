import { Request, Response, NextFunction } from 'express'
import { workerRegistry } from '../services/worker.registry.js'
import { workerService } from '../services/worker.service.js'
import { autoscalerService } from '../services/autoscaler.service.js'
import { redisClient } from '../config/redis.config.js'

// Track in-process worker loops by workerId
const runningWorkers: Map<string, boolean> = new Map()

/**
 * Controller to expose active worker details and management.
 */
export const workerController = {
  /**
   * Restful fetch interface for surfacing all workers.
   */
  getWorkers: async (req: Request, res: Response) => {
    const workers = await workerRegistry.getAll()
    res.json({ workers })
  },

  /**
   * Controller API route executing a custom background instance of the generic backend worker daemon.
   */
  startWorker: async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { queue_name = 'default', worker_id, auto_restart = false } = req.body

      // Ensure API-started workers have the correct prefix for self-healing
      if (!worker_id.startsWith('api-')) {
        worker_id = `api-${worker_id}`
      }

      if (runningWorkers.get(worker_id)) {
        return res.status(409).json({ error: `Worker '${worker_id}' is already running` })
      }

      await workerRegistry.register(worker_id, queue_name, auto_restart)
      runningWorkers.set(worker_id, true)
      workerService.startInstance(queue_name, worker_id)

      redisClient.publish('pulsar:events', JSON.stringify({ type: 'worker_update', worker_id }))

      res.json({ message: `Worker '${worker_id}' started on queue '${queue_name}'` })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Controller API route halting a currently running instance of a spawned worker daemon.
   */
  stopWorker: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { worker_id, auto_restart = false, restart_in } = req.body

      // Broadcast the stop signal to the whole cluster
      redisClient.publish('pulsar:worker_control', JSON.stringify({ action: 'stop', worker_id }))
      
      if (restart_in && restart_in > 0) {
        const restartAt = new Date(Date.now() + restart_in * 1000)
        await workerRegistry.setRestartAt(worker_id, restartAt)
        res.json({ message: `Worker '${worker_id}' stopped and scheduled for restart at ${restartAt.toISOString()}` })
      } else {
        await workerRegistry.setStopped(worker_id, auto_restart)
        res.json({ message: `Worker '${worker_id}' stopped` })
      }
      
      runningWorkers.delete(worker_id)
      redisClient.publish('pulsar:events', JSON.stringify({ type: 'worker_update', worker_id }))
    } catch (err) {
      next(err)
    }
  },

  /**
   * Returns current active Auto-Scaling boundaries per queue.
   */
  getAutoscalerConfig: (req: Request, res: Response) => {
    res.json({ config: autoscalerService.getConfig() })
  },

  /**
   * Passes updated Auto-Scaling behavior rules to the underlying manager.
   */
  updateAutoscalerConfig: (req: Request, res: Response) => {
    const { queue_name, config } = req.body
    const updated = autoscalerService.setConfig(queue_name, config)
    res.json({ message: 'Autoscaler config updated', queue_name, config: updated })
  },

  /**
   * API route to simulate a worker crash by stopping the loop without registry cleanup.
   */
  crashWorker: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { worker_id } = req.body
      
      // Broadcast the crash signal to the whole cluster
      redisClient.publish('pulsar:worker_control', JSON.stringify({ action: 'crash', worker_id }))
      runningWorkers.delete(worker_id)
      
      // DO NOT update the registry here. 
      // This will cause the worker to eventually appear stale and trigger recovery.
      
      redisClient.publish('pulsar:events', JSON.stringify({ type: 'worker_update', worker_id }))

      res.json({ message: `Worker '${worker_id}' intentionally crashed (simulation)` })
    } catch (err) {
      next(err)
    }
  }
}

// Export distinct methods for route bindings
export const { getWorkers, startWorker, stopWorker, crashWorker, getAutoscalerConfig, updateAutoscalerConfig } = workerController
