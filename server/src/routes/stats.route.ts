import { Router, Request, Response, NextFunction } from 'express'
import { statsService } from '../services/stats.service.js'

const router: Router = Router()

/**
 * GET /api/stats
 * Returns job counts by status, queue depths from Redis, and attempt totals.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Job status counts from PostgreSQL
    res.json(await statsService.getStats())
  } catch (err) {

    next(err)
  }
})

export default router
