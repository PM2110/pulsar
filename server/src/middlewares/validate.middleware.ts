import { Request, Response, NextFunction } from 'express'
import { ZodTypeAny, ZodError } from 'zod'

/**
 * Validates the Express request body against a supplied Zod schemas.
 * Injects cleanly parsed properties directly back into req.body and abstracts 400 responses.
 */
export const validateRequest = (schema: ZodTypeAny) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body)
      req.body = parsed
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.format() })
      }
      next(err)
    }
  }
}
