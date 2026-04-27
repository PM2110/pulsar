import { Router, Request, Response, NextFunction } from 'express'
import { workerRegistry } from '../services/worker.registry.js'
import { workerService } from '../services/worker.service.js'

const router: Router = Router()

// Track in-process worker loops by workerId
const runningWorkers: Map<string, boolean> = new Map()

/**
 * GET /api/workers
 * Lists all registered worker instances.
 */
router.get('/', (req: Request, res: Response) => {
  const workers = workerRegistry.getAll()
  res.json({ workers })
})

/**
 * POST /api/workers/start
 * Starts a new in-process worker for the given queue.
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { queue_name = 'default', worker_id } = req.body

    if (!worker_id) {
      return res.status(400).json({ error: 'worker_id is required' })
    }

    if (runningWorkers.get(worker_id)) {
      return res.status(409).json({ error: `Worker '${worker_id}' is already running` })
    }

    // Register in registry
    workerRegistry.register(worker_id, queue_name)
    runningWorkers.set(worker_id, true)

    // Start the worker loop in background (fire and forget)
    workerService.startInstance(queue_name, worker_id)

    res.json({ message: `Worker '${worker_id}' started on queue '${queue_name}'` })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/workers/stop
 * Stops a specific worker instance.
 */
router.post('/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { worker_id } = req.body

    if (!worker_id) {
      return res.status(400).json({ error: 'worker_id is required' })
    }

    workerService.stopInstance(worker_id)
    workerRegistry.setStopped(worker_id)
    runningWorkers.delete(worker_id)

    res.json({ message: `Worker '${worker_id}' stopped` })
  } catch (err) {
    next(err)
  }
})

export default router
