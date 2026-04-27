import { Request, Response } from 'express'
import { env } from '../config/env.config.js'

export const getHealth = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: env.NODE_ENV
  })
}
