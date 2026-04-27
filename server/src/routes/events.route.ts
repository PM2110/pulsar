import { Router, Request, Response } from 'express'
import { query } from '../config/db.config.js'

const router: Router = Router()

// Store SSE clients for broadcasting
const clients: Set<Response> = new Set()

// Track last-seen status per job to detect changes
let lastJobStates: Map<string, string> = new Map()

// Poll DB and push events to connected clients
async function pollAndBroadcast() {
  try {
    const result = await query(
      `SELECT id, status, job_type, queue_name, attempts, max_attempts, last_error, updated_at
       FROM jobs
       ORDER BY updated_at DESC
       LIMIT 100`
    )

    const events: any[] = []

    for (const job of result.rows) {
      const prevStatus = lastJobStates.get(job.id)
      if (prevStatus !== job.status) {
        lastJobStates.set(job.id, job.status)
        if (prevStatus !== undefined) {
          // Only emit if it actually changed (not first load)
          events.push({
            type: 'job_update',
            job_id: job.id,
            job_type: job.job_type,
            queue_name: job.queue_name,
            status: job.status,
            prev_status: prevStatus,
            attempts: job.attempts,
            max_attempts: job.max_attempts,
            error: job.last_error || null,
            timestamp: new Date().toISOString()
          })
        }
      }
    }

    if (events.length > 0 && clients.size > 0) {
      const data = JSON.stringify(events)
      for (const client of clients) {
        try {
          client.write(`data: ${data}\n\n`)
        } catch {
          clients.delete(client)
        }
      }
    }
  } catch {
    // Silently ignore polling errors
  }
}

// Start polling every 1.5s
setInterval(pollAndBroadcast, 1500)

/**
 * GET /api/events
 * SSE stream for real-time job status updates.
 */
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  clients.add(res)

  // Send a heartbeat every 15s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
    }
  }, 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(res)
  })
})

export default router
