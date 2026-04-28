import { Request, Response } from 'express'
import { env } from '../config/env.config.js'

/**
 * Simple health probe integration API routes.
 */
export const healthController = {
  /**
   * Relays the local timestamp, overall server uptime, and Node variables ensuring successful docker provisioning.
   */
  getHealth: (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: env.NODE_ENV
    })
  }
}

export const { getHealth } = healthController
