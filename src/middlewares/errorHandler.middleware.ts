import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.config.js'
import { AppError, AppErrorResponse } from '../types/error.types.js'

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500
  const isDevelopment = env.NODE_ENV === 'development'

  // Log error using pino-http logs
  req.log ? req.log.error(err) : console.error(err)

  const response: AppErrorResponse = {
    statusCode,
    error: err.name || 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  }

  // Production logic: mask internal error details for 500+ errors
  if (!isDevelopment && statusCode >= 500) {
    response.message = 'An unexpected error occurred'
  }

  // Development logic: include stack trace
  if (isDevelopment) {
    response.stack = err.stack
  }

  res.status(statusCode).json(response)
}
