import { Router } from 'express'
import { createJob, getJobs, getJobById, updateJob, deleteJob, retryJob, getAttempts } from '../controllers/job.controller.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { createJobSchema, updateJobSchema } from '../types/job.schema.js'

const router: Router = Router()

router.post('/', validateRequest(createJobSchema), createJob)
router.get('/', getJobs)
router.get('/attempts', getAttempts)
router.get('/:id', getJobById)
router.patch('/:id', validateRequest(updateJobSchema), updateJob)
router.delete('/:id', deleteJob)
router.post('/:id/retry', retryJob)

export default router
