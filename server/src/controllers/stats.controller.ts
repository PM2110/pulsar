import { Request, Response, NextFunction } from 'express'
import { statsService } from '../services/stats.service.js'

/**
 * Controller encompassing broad statistics collection for queue analysis logic.
 */
export const statsController = {
  /**
   * Relays a fully aggregated PostgreSQL analytics metric cluster covering all active attempts, execution velocities, and queues.
   */
  getStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await statsService.getStats())
    } catch (err) {
      next(err)
    }
  }
}

export const { getStats } = statsController
