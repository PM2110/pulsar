import { Router } from 'express'
import { seedJobs } from '../controllers/seed.controller.js'
import { validateRequest } from '../middlewares/validate.middleware.js'
import { seedJobsSchema } from '../types/seed.schema.js'

const router: Router = Router()

router.post('/', validateRequest(seedJobsSchema), seedJobs)

export default router
