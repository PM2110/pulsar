import { Request, Response, NextFunction } from 'express'
import { query } from '../config/db.config.js'
import { createJobSchema, updateJobSchema } from '../types/job.schema.js'
import { QUEUE_MAP, DEFAULT_QUEUE } from '../config/queue.config.js'
import { queueService } from '../services/queue.service.js'

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
      run_at,
      failure_mode,
      fail_probability
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
        run_at,
        failure_mode,
        fail_probability
      ) 
      VALUES ($1, $2, $3, 'pending', $4, $5, COALESCE($6, NOW()), $7, $8)
      RETURNING *
    `

    const values = [
      queue_name,
      job_type,
      JSON.stringify(payload),
      priority,
      max_attempts,
      run_at || null,
      failure_mode,
      fail_probability
    ]

    const result = await query(insertQuery, values)
    const newJob = result.rows[0]

    // Enqueue if run_at is now or in the past
    // If run_at is not provided, COALESCE set it to NOW() in DB, so it's immediate.
    const isImmediate = !run_at || new Date(run_at) <= new Date()

    if (isImmediate) {
      await queueService.enqueueJob(queue_name, newJob.id, priority)
    } else {
      // Schedule in Redis delayed queue
      const runAtDate = new Date(run_at)
      await queueService.enqueueDelayedJob(queue_name, newJob.id, priority, runAtDate.getTime())
    }

    res.status(201).json({
      message: 'Job created successfully',
      job: newJob
    })
  } catch (err) {
    // Pass to error handler middleware
    next(err)
  }
}

/**
 * GET /api/jobs
 * Lists jobs with optional filtering.
 */
export const getJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined
    const queue_name = req.query.queue_name as string | undefined
    const limit = Number(req.query.limit) || 50
    const offset = Number(req.query.offset) || 0

    let queryText = 'SELECT * FROM jobs WHERE 1=1'
    const params: any[] = []

    if (status) {
      params.push(status)
      queryText += ` AND status = $${params.length}`
    }
    if (queue_name) {
      params.push(queue_name)
      queryText += ` AND queue_name = $${params.length}`
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`

    // Get total count (without limit/offset)
    let countQueryText = 'SELECT COUNT(*) as total FROM jobs WHERE 1=1'
    if (status) {
      countQueryText += ` AND status = $1`
    }
    if (queue_name) {
      countQueryText += ` AND queue_name = $${status ? 2 : 1}`
    }

    params.push(limit, offset)

    const [result, countResult] = await Promise.all([
      query(queryText, params),
      query(countQueryText, params.slice(0, -2))
    ])

    res.json({
      jobs: result.rows,
      meta: {
        limit: Number(limit),
        offset: Number(offset),
        count: parseInt(countResult.rows[0].total, 10)
      }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/jobs/:id
 */
export const getJobById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const result = await query('SELECT * FROM jobs WHERE id = $1', [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' })
    }

    res.json({ job: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/jobs/:id
 */
export const updateJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const validatedData = updateJobSchema.parse(req.body)

    // Get existing job to check status and old queue
    const oldJobResult = await query('SELECT * FROM jobs WHERE id = $1', [id])
    if (oldJobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' })
    }
    const oldJob = oldJobResult.rows[0]

    // Build Update Query
    const updates: string[] = []
    const values: any[] = []

    Object.entries(validatedData).forEach(([key, value]) => {
      if (value !== undefined) {
        values.push(key === 'payload' ? JSON.stringify(value) : value)
        updates.push(`${key} = $${values.length}`)
      }
    })

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' })
    }

    values.push(id)
    const updateQuery = `
      UPDATE jobs 
      SET ${updates.join(', ')}, updated_at = NOW() 
      WHERE id = $${values.length} 
      RETURNING *
    `
    const result = await query(updateQuery, values)
    const updatedJob = result.rows[0]

    // Redis Sync Logic
    // If it was pending, and metadata changed, we might need to move it in Redis
    if (oldJob.status === 'pending') {
      const queueChanged = updatedJob.queue_name !== oldJob.queue_name || updatedJob.job_type !== oldJob.job_type
      const priorityChanged = updatedJob.priority !== Number(oldJob.priority)
      const runAtChanged = updatedJob.run_at !== oldJob.run_at

      if (queueChanged || priorityChanged || runAtChanged) {
        // Remove from old queue
        await queueService.removeFromQueue(oldJob.queue_name, id)

        // Enqueue in new queue if it's still pending and immediate
        const isImmediate = updatedJob.status === 'pending' && (!updatedJob.run_at || new Date(updatedJob.run_at) <= new Date())
        if (isImmediate) {
          await queueService.enqueueJob(updatedJob.queue_name, id, updatedJob.priority)
        }
      }
    }

    res.json({ message: 'Job updated successfully', job: updatedJob })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/jobs/:id
 */
export const deleteJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string

    // Get job to check status
    const jobResult = await query('SELECT * FROM jobs WHERE id = $1', [id])
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' })
    }
    const job = jobResult.rows[0]

    // Delete from DB
    await query('DELETE FROM jobs WHERE id = $1', [id])

    // Remove from Redis if it was pending
    if (job.status === 'pending') {
      await queueService.removeFromQueue(job.queue_name, id)
    }

    res.json({ message: 'Job deleted successfully' })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/jobs/:id/retry
 * Manually retries a failed job by resetting its attempts and enqueuing it.
 */
export const retryJob = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string

    // Get job to check status
    const jobResult = await query('SELECT * FROM jobs WHERE id = $1', [id])
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' })
    }
    const job = jobResult.rows[0]

    if (job.status !== 'failed') {
      return res.status(400).json({ error: 'Only failed jobs can be retried' })
    }

    // Reset job and set it to pending
    const updateQuery = `
      UPDATE jobs
      SET status = 'pending',
          attempts = 0,
          last_error = NULL,
          failed_at = NULL,
          updated_at = NOW(),
          run_at = NOW()
      WHERE id = $1
      RETURNING *
    `
    const updatedResult = await query(updateQuery, [id])
    const updatedJob = updatedResult.rows[0]

    // Enqueue job immediately
    await queueService.enqueueJob(updatedJob.queue_name, id, updatedJob.priority)

    res.json({ message: 'Job retried successfully', job: updatedJob })
  } catch (err) {
    next(err)
  }
}
