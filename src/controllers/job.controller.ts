import { Request, Response, NextFunction } from 'express'
import { query } from '../config/db.config.js'
import { createJobSchema } from '../types/job.schema.js'
import { QUEUE_MAP, DEFAULT_QUEUE } from '../config/queue.config.js'

/**
 * POST /api/jobs
 * Creates a new job with 'pending' status.
 */
export const createJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate Input
    const validatedData = createJobSchema.parse(req.body)

    const {
      queue_name: provided_queue_name,
      job_type,
      payload,
      priority,
      max_attempts,
      run_at
    } = validatedData

    // Derive queue_name from map if not explicitly provided
    const queue_name = provided_queue_name || QUEUE_MAP[job_type] || DEFAULT_QUEUE

    // Insert into Database
    const insertQuery = `
      INSERT INTO jobs (
        queue_name, 
        job_type, 
        payload, 
        status, 
        priority, 
        max_attempts, 
        run_at
      ) 
      VALUES ($1, $2, $3, 'pending', $4, $5, COALESCE($6, NOW()))
      RETURNING *
    `

    const values = [
      queue_name,
      job_type,
      JSON.stringify(payload),
      priority,
      max_attempts,
      run_at || null
    ]

    const result = await query(insertQuery, values)
    const newJob = result.rows[0]

    // Return Response
    res.status(201).json({
      message: 'Job created successfully',
      job: newJob
    })
  } catch (err) {
    // Pass to error handler middleware
    next(err)
  }
}
