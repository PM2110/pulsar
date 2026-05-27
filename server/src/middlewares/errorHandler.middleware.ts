import { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.config.js'
import { AppError, AppErrorResponse } from '../types/error.types.js'
import { logger } from '../utils/logger.js'

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500
  const isDevelopment = env.NODE_ENV === 'development'

  // Store error message for the response log
  res.locals.errorMessage = err.message

  // Log error using custom logger (only log stack trace details if it is a 500+ error)
  if (statusCode >= 500) {
    logger.error(`API Exception on ${req.method} ${req.originalUrl || req.url}`, err, 'API')
  } else {
    logger.warn(`API Bad Request on ${req.method} ${req.originalUrl || req.url}: ${err.message}`, 'API')
  }

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
