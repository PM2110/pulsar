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
        idempotency_key,
        max_infra_attempts
      } = req.body

      const queue_name = provided_queue_name || QUEUE_MAP[job_type] || DEFAULT_QUEUE

      client = await getClient()
      await client.query('BEGIN')

      const insertQuery = `
        INSERT INTO jobs (
          queue_name, job_type, payload, status, priority, 
          max_attempts, run_at, failure_mode, fail_probability, idempotency_key,
          max_infra_attempts
        ) 
        VALUES ($1, $2, $3, 'pending', $4, $5, COALESCE($6, NOW()), $7, $8, $9, COALESCE($10, 3))
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING *
      `

      const values = [
        queue_name, job_type, JSON.stringify(payload), priority, max_attempts,
        run_at || null, failure_mode, fail_probability, idempotency_key || null,
        max_infra_attempts !== undefined ? max_infra_attempts : null
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

      // Whitelist columns and order directions to prevent SQL Injection and syntax errors
      const allowedColumns = ['id', 'job_type', 'queue_name', 'status', 'priority', 'failure_mode', 'created_at', 'updated_at', 'attempts', 'max_attempts', 'infra_attempts', 'max_infra_attempts']
      const allowedOrders = ['asc', 'desc']

      const sort_by = allowedColumns.includes(req.query.sort_by as string)
        ? (req.query.sort_by as string)
        : 'id'
      const sort_order = allowedOrders.includes(String(req.query.sort_order).toLowerCase())
        ? String(req.query.sort_order).toLowerCase()
        : 'asc'

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

      queryText += ` ORDER BY ${sort_by} ${sort_order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`

      let countQueryText = 'SELECT COUNT(*) as total FROM jobs WHERE 1=1'
      if (status) countQueryText += ` AND status = $1`
      if (queue_name) countQueryText += ` AND queue_name = $${status ? 2 : 1}`

      params.push(limit, offset)

      const [result, countResult] = await Promise.all([
        query(queryText, params),
        query(countQueryText, params.slice(0, -2))
      ])

      const totalRecords = parseInt(countResult.rows[0].total, 10)
      const totalPages = Math.ceil(totalRecords / limit)
      const currentPage = Math.floor(offset / limit) + 1
      const hasMore = offset + limit < totalRecords

      const jobs = offset >= totalRecords && totalRecords > 0 ? [] : result.rows

      res.json({
        jobs,
        meta: { limit, offset, count: totalRecords },
        pagination: {
          totalRecords,
          totalPages,
          currentPage,
          limit,
          offset,
          hasMore
        }
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
      const [jobRes, attemptsRes] = await Promise.all([
        query('SELECT * FROM jobs WHERE id = $1', [id]),
        query('SELECT * FROM job_attempts WHERE job_id = $1 ORDER BY attempt_number ASC', [id])
      ])

      if (jobRes.rows.length === 0) return res.status(404).json({ error: 'Job not found' })
      res.json({
        job: jobRes.rows[0],
        attempts: attemptsRes.rows
      })
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
  },

  /**
   * GET /api/jobs/attempts
   * Retrieves a list of job attempts with details.
   */
  getAttempts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 100
      const page = Number(req.query.page) || 1
      const offset = (page - 1) * limit
      const status = req.query.status as string | undefined
      const queue_name = req.query.queue_name as string | undefined
      const job_type = req.query.job_type as string | undefined
      const search = req.query.search as string | undefined

      let queryText = `
        SELECT 
          ja.id::text,
          ja.job_id::text,
          ja.attempt_number,
          ja.status,
          ja.worker_id,
          ja.error,
          ja.stack_trace,
          ja.started_at,
          ja.finished_at,
          ja.created_at,
          ja.scheduled_at,
          ja.worker_hostname,
          ja.worker_pid,
          ja.queue_latency_ms,
          ja.execution_time_ms,
          j.job_type,
          j.queue_name,
          j.payload,
          j.infra_attempts,
          j.max_infra_attempts
        FROM job_attempts ja
        JOIN jobs j ON ja.job_id = j.id
        WHERE 1=1
      `
      const params: any[] = []

      if (status) {
        params.push(status)
        queryText += ` AND ja.status = $${params.length}`
      }
      if (queue_name) {
        params.push(queue_name)
        queryText += ` AND j.queue_name = $${params.length}`
      }
      if (job_type) {
        params.push(job_type)
        queryText += ` AND j.job_type = $${params.length}`
      }
      if (search) {
        params.push(`%${search}%`)
        queryText += ` AND (
          j.job_type ILIKE $${params.length} OR
          j.queue_name ILIKE $${params.length} OR
          ja.job_id::text ILIKE $${params.length} OR
          ja.worker_id ILIKE $${params.length} OR
          ja.error ILIKE $${params.length}
        )`
      }

      queryText += ` ORDER BY ja.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
      params.push(limit, offset)

      const result = await query(queryText, params)

      // Count Query
      const countParams: any[] = []
      let countQueryText = `
        SELECT COUNT(*) as total 
        FROM job_attempts ja
        JOIN jobs j ON ja.job_id = j.id
        WHERE 1=1
      `
      if (status) {
        countParams.push(status)
        countQueryText += ` AND ja.status = $${countParams.length}`
      }
      if (queue_name) {
        countParams.push(queue_name)
        countQueryText += ` AND j.queue_name = $${countParams.length}`
      }
      if (job_type) {
        countParams.push(job_type)
        countQueryText += ` AND j.job_type = $${countParams.length}`
      }
      if (search) {
        countParams.push(`%${search}%`)
        countQueryText += ` AND (
          j.job_type ILIKE $${countParams.length} OR
          j.queue_name ILIKE $${countParams.length} OR
          ja.job_id::text ILIKE $${countParams.length} OR
          ja.worker_id ILIKE $${countParams.length} OR
          ja.error ILIKE $${countParams.length}
        )`
      }

      const countResult = await query(countQueryText, countParams)
      const totalRecords = parseInt(countResult.rows[0].total, 10)
      const totalPages = Math.ceil(totalRecords / limit)
      const currentPage = page
      const hasMore = offset + limit < totalRecords

      const attempts = offset >= totalRecords && totalRecords > 0 ? [] : result.rows

      res.json({
        attempts,
        pagination: {
          totalRecords,
          totalPages,
          currentPage,
          limit,
          offset,
          hasMore
        }
      })
    } catch (err) {
      next(err)
    }
  }
}

// Named exports for expressive explicit router associations
export const { createJob, getJobs, getJobById, updateJob, deleteJob, retryJob, getAttempts } = jobController
