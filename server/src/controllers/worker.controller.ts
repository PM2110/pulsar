import { Request, Response, NextFunction } from 'express'
import { workerRegistry } from '../services/worker.registry.js'
import { workerService } from '../services/worker.service.js'
import { autoscalerService } from '../services/autoscaler.service.js'

// Track in-process worker loops by workerId
const runningWorkers: Map<string, boolean> = new Map()

/**
 * Controller to expose active worker details and management.
 */
export const workerController = {
  /**
   * Restful fetch interface for surfacing all workers.
   */
  getWorkers: (req: Request, res: Response) => {
    const workers = workerRegistry.getAll()
    res.json({ workers })
  },

  /**
   * Controller API route executing a custom background instance of the generic backend worker daemon.
   */
  startWorker: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { queue_name = 'default', worker_id } = req.body

      if (runningWorkers.get(worker_id)) {
        return res.status(409).json({ error: `Worker '${worker_id}' is already running` })
      }

      workerRegistry.register(worker_id, queue_name)
      runningWorkers.set(worker_id, true)
      workerService.startInstance(queue_name, worker_id)

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
      const { worker_id } = req.body

      workerService.stopInstance(worker_id)
      workerRegistry.setStopped(worker_id)
      runningWorkers.delete(worker_id)

      res.json({ message: `Worker '${worker_id}' stopped` })
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
  }
}

// Export distinct methods for route bindings
export const { getWorkers, startWorker, stopWorker, getAutoscalerConfig, updateAutoscalerConfig } = workerController
