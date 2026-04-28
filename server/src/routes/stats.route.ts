import { Router } from 'express'
import { getStats } from '../controllers/stats.controller.js'

const router: Router = Router()

router.get('/', getStats)

export default router
