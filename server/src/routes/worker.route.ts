import { Router } from 'express'
import { getWorkers, startWorker, stopWorker, getAutoscalerConfig, updateAutoscalerConfig } from '../controllers/worker.controller.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { startWorkerSchema, stopWorkerSchema, updateAutoscalerConfigSchema } from '../types/worker.schema.js'

const router: Router = Router()

router.get('/', getWorkers)
router.post('/start', validateRequest(startWorkerSchema), startWorker)
router.post('/stop', validateRequest(stopWorkerSchema), stopWorker)
router.get('/autoscaler', getAutoscalerConfig)
router.post('/autoscaler', validateRequest(updateAutoscalerConfigSchema), updateAutoscalerConfig)

export default router
