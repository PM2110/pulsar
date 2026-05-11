import { Request, Response, NextFunction } from 'express'
import { query, getClient } from '../config/db.config.js'
import { QUEUE_MAP, DEFAULT_QUEUE } from '../config/queue.config.js'
import { queueService } from '../services/queue.service.js'

/**
 * Controller encompassing all direct REST invocations mutating or fetching core job entity details.
 */
export const jobController = {
  /**
   * POST /api/jobs
   * Creates a new job with 'pending' status and orchestrates correct queue insertions natively.
   */
  createJob: async (req: Request, res: Response, next: NextFunction) => {
    let client;
    try {
      const {
        queue_name: provided_queue_name,
        job_type,
        payload,
        priority,
        max_attempts,
        run_at,
        failure_mode,
        fail_probability,
        idempotency_key
      } = req.body

      const queue_name = provided_queue_name || QUEUE_MAP[job_type] || DEFAULT_QUEUE

      client = await getClient()
      await client.query('BEGIN')

      const insertQuery = `
        INSERT INTO jobs (
          queue_name, job_type, payload, status, priority, 
          max_attempts, run_at, failure_mode, fail_probability, idempotency_key
        ) 
        VALUES ($1, $2, $3, 'pending', $4, $5, COALESCE($6, NOW()), $7, $8, $9)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
      `

      const values = [
        queue_name, job_type, JSON.stringify(payload), priority, max_attempts,
        run_at || null, failure_mode, fail_probability, idempotency_key || null
      ]

      const result = await client.query(insertQuery, values)

      let jobToEnqueue;
      let isNew = true;

      if (result.rows.length === 0 && idempotency_key) {
        // Idempotency conflict: find existing job
        const existingResult = await client.query('SELECT * FROM jobs WHERE idempotency_key = $1', [idempotency_key])
        jobToEnqueue = existingResult.rows[0]
        isNew = false
      } else {
        jobToEnqueue = result.rows[0]
      }

      if (isNew) {
        const isImmediate = !run_at || new Date(run_at) <= new Date()
        if (isImmediate) {
          await queueService.enqueueJob(queue_name, jobToEnqueue.id, priority)
        } else {
          const runAtDate = new Date(run_at)
          await queueService.enqueueDelayedJob(queue_name, jobToEnqueue.id, priority, runAtDate.getTime())
        }
      }

      await client.query('COMMIT')
      res.status(isNew ? 201 : 200).json({
        message: isNew ? 'Job created successfully' : 'Idempotent request: Job already exists',
        job: jobToEnqueue
      })
    } catch (err) {
      if (client) await client.query('ROLLBACK')
      next(err)
    } finally {
      if (client) client.release()
    }
  },

  /**
   * GET /api/jobs
   * Lists comprehensive job payload arrays filtered dynamically using express queries.
   */
  getJobs: async (req: Request, res: Response, next: NextFunction) => {
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

      queryText += ` ORDER BY id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`

      let countQueryText = 'SELECT COUNT(*) as total FROM jobs WHERE 1=1'
      if (status) countQueryText += ` AND status = $1`
      if (queue_name) countQueryText += ` AND queue_name = $${status ? 2 : 1}`

      params.push(limit, offset)

      const [result, countResult] = await Promise.all([
        query(queryText, params),
        query(countQueryText, params.slice(0, -2))
      ])

      res.json({
        jobs: result.rows,
        meta: { limit, offset, count: parseInt(countResult.rows[0].total, 10) }
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/jobs/:id
   * Resolves explicit single job details directly mapping to specific identifiers.
   */
  getJobById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const result = await query('SELECT * FROM jobs WHERE id = $1', [id])

      if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' })
      res.json({ job: result.rows[0] })
    } catch (err) {
      next(err)
    }
  },

  /**
   * PATCH /api/jobs/:id
   * Reinvigorates targeted keys dynamically against active entities bridging redis adjustments natively.
   */
  updateJob: async (req: Request, res: Response, next: NextFunction) => {
    let client;
    try {
      const id = req.params.id as string

      client = await getClient()
      await client.query('BEGIN')

      const oldJobResult = await client.query('SELECT * FROM jobs WHERE id = $1 FOR UPDATE', [id])
      if (oldJobResult.rows.length === 0) {
        await client.query('ROLLBACK')
        client.release()
        return res.status(404).json({ error: 'Job not found' })
      }
      const oldJob = oldJobResult.rows[0]

      const updates: string[] = []
      const values: any[] = []

      Object.entries(req.body).forEach(([key, value]) => {
        if (value !== undefined) {
          values.push(key === 'payload' ? JSON.stringify(value) : value)
          updates.push(`${key} = $${values.length}`)
        }
      })

      if (updates.length === 0) {
        await client.query('ROLLBACK')
        client.release()
        return res.status(400).json({ error: 'No fields provided for update' })
      }

      values.push(id)
      const updateQuery = `UPDATE jobs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`
      const result = await client.query(updateQuery, values)
      const updatedJob = result.rows[0]

      if (oldJob.status === 'pending') {
        const queueChanged = updatedJob.queue_name !== oldJob.queue_name || updatedJob.job_type !== oldJob.job_type
        const priorityChanged = updatedJob.priority !== Number(oldJob.priority)
        const runAtChanged = updatedJob.run_at !== oldJob.run_at

        if (queueChanged || priorityChanged || runAtChanged) {
          await queueService.removeFromQueue(oldJob.queue_name, id)
          const isImmediate = updatedJob.status === 'pending' && (!updatedJob.run_at || new Date(updatedJob.run_at) <= new Date())
          if (isImmediate) await queueService.enqueueJob(updatedJob.queue_name, id, updatedJob.priority)
        }
      }

      await client.query('COMMIT')
      res.json({ message: 'Job updated successfully', job: updatedJob })
    } catch (err) {
      if (client) await client.query('ROLLBACK')
      next(err)
    } finally {
      if (client) client.release()
    }
  },

  /**
   * DELETE /api/jobs/:id
   * Destroys all references synchronously deleting elements entirely out of storage and cache interfaces.
   */
  deleteJob: async (req: Request, res: Response, next: NextFunction) => {
    let client;
    try {
      const id = req.params.id as string

      client = await getClient()
      await client.query('BEGIN')

      const jobResult = await client.query('SELECT * FROM jobs WHERE id = $1 FOR UPDATE', [id])
      if (jobResult.rows.length === 0) {
        await client.query('ROLLBACK')
        client.release()
        return res.status(404).json({ error: 'Job not found' })
      }

      const job = jobResult.rows[0]
      await client.query('DELETE FROM jobs WHERE id = $1', [id])
      if (job.status === 'pending') await queueService.removeFromQueue(job.queue_name, id)

      await client.query('COMMIT')
      res.json({ message: 'Job deleted successfully' })
    } catch (err) {
      if (client) await client.query('ROLLBACK')
      next(err)
    } finally {
      if (client) client.release()
    }
  },

  /**
   * POST /api/jobs/:id/retry
   * Manually executes explicit retry resets wiping clean any failure parameters re-establishing active queue positions natively.
   */
  retryJob: async (req: Request, res: Response, next: NextFunction) => {
    let client;
    try {
      const id = req.params.id as string

      client = await getClient()
      await client.query('BEGIN')

      const jobResult = await client.query('SELECT * FROM jobs WHERE id = $1 FOR UPDATE', [id])
      if (jobResult.rows.length === 0) {
        await client.query('ROLLBACK')
        client.release()
        return res.status(404).json({ error: 'Job not found' })
      }
      const job = jobResult.rows[0]

      if (job.status !== 'failed') {
        await client.query('ROLLBACK')
        client.release()
        return res.status(400).json({ error: 'Only failed jobs can be retried' })
      }

      const updateQuery = `
        UPDATE jobs
        SET status = 'pending', last_error = NULL, failed_at = NULL, updated_at = NOW(), run_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      const updatedResult = await client.query(updateQuery, [id])
      const updatedJob = updatedResult.rows[0]

      await queueService.enqueueJob(updatedJob.queue_name, id, updatedJob.priority)

      await client.query('COMMIT')
      res.json({ message: 'Job retried successfully', job: updatedJob })
    } catch (err) {
      if (client) await client.query('ROLLBACK')
      next(err)
    } finally {
      if (client) client.release()
    }
  }
}

// Named exports for expressive explicit router associations
export const { createJob, getJobs, getJobById, updateJob, deleteJob, retryJob } = jobController
