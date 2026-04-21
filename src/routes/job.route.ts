import { Router } from 'express'
import * as jobController from '../controllers/job.controller.js'

const router: Router = Router()

/**
 * Route: POST /
 * Description: Create a new job
 */
router.post('/', jobController.createJob)

export default router
