import { Router } from 'express'
import { workerController, getWorkers, startWorker, stopWorker, crashWorker, getAutoscalerConfig, updateAutoscalerConfig, updateWorkerSettings, deleteWorker } from '../controllers/worker.controller.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { startWorkerSchema, stopWorkerSchema, updateAutoscalerConfigSchema, updateWorkerSettingsSchema } from '../types/worker.schema.js'

const router: Router = Router()

router.get('/', getWorkers)
router.post('/start', validateRequest(startWorkerSchema), startWorker)
router.post('/stop', validateRequest(stopWorkerSchema), stopWorker)
router.post('/crash', validateRequest(stopWorkerSchema), crashWorker)
router.post('/settings', validateRequest(updateWorkerSettingsSchema), updateWorkerSettings)
router.delete('/:worker_id', deleteWorker)
router.get('/autoscaler', getAutoscalerConfig)
router.post('/autoscaler', validateRequest(updateAutoscalerConfigSchema), updateAutoscalerConfig)

export default router
