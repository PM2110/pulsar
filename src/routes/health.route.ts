import { Router } from 'express'
import * as healthController from '../controllers/health.controller.js'

const router: Router = Router()

router.get('/', healthController.getHealth)

export default router
