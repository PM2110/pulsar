import { Router } from 'express'
import { createJob, getJobs, getJobById, updateJob, deleteJob } from '../controllers/job.controller.js'

const router: Router = Router()

router.post('/', createJob)
router.get('/', getJobs)
router.get('/:id', getJobById)
router.patch('/:id', updateJob)
router.delete('/:id', deleteJob)

export default router
