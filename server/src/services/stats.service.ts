import { query } from '../config/db.config.js'
import { redisClient } from '../config/redis.config.js'

export const statsService = {
  getStats: async () => {
    // Job status counts from PostgreSQL
    const statusResult = await query(`
      SELECT status, COUNT(*) as count
      FROM jobs
      GROUP BY status
    `)

    const statusCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    }
    for (const row of statusResult.rows) {
      statusCounts[row.status] = parseInt(row.count, 10)
    }

    // Total jobs
    const totalResult = await query('SELECT COUNT(*) as count FROM jobs')
    const total = parseInt(totalResult.rows[0].count, 10)

    // Queue depths from Redis
    const queues = ['notifications', 'media', 'default']
    const queueDepths: Record<string, number> = {}
    const delayedDepths: Record<string, number> = {}
    // Ready queue: fetch run_at from DB for those IDs so client can show wait time
    const readyJobs: Record<string, { id: string; runAt: number }[]> = {}
    const delayedJobs: Record<string, { id: string; runAt: number }[]> = {}

    for (const q of queues) {
      queueDepths[q] = await redisClient.zCard(`queue:${q}`)
      delayedDepths[q] = await redisClient.zCard(`delayed:queue:${q}`)

      // Ready queue: get up to 12 IDs, then enrich with run_at from DB
      const readyMembers = await redisClient.zRange(`queue:${q}`, 0, 11)
      if (readyMembers.length > 0) {
        const runAtResult = await query(
          `SELECT id::text, EXTRACT(EPOCH FROM run_at) * 1000 AS run_at_ms FROM jobs WHERE id = ANY($1::bigint[])`,
          [readyMembers]
        )
        const runAtMap: Record<string, number> = {}
        for (const r of runAtResult.rows) runAtMap[r.id] = parseFloat(r.run_at_ms)
        readyJobs[q] = readyMembers.map(id => ({ id, runAt: runAtMap[id] ?? Date.now() }))
      } else {
        readyJobs[q] = []
      }

      // Delayed queue: job IDs + scheduled timestamp (score = ms timestamp)
      const delayedMembers = await redisClient.zRangeWithScores(`delayed:queue:${q}`, 0, 8)
      delayedJobs[q] = delayedMembers.map(({ value, score }) => ({
        id: value.split(':')[0],
        runAt: score
      }))
    }

    // Per-queue processing jobs — with worker info from latest job_attempt
    const processingResult = await query(`
      SELECT
        j.id::text,
        j.queue_name,
        ja.worker_id,
        ja.worker_hostname
      FROM jobs j
      LEFT JOIN LATERAL (
        SELECT worker_id, worker_hostname
        FROM job_attempts
        WHERE job_id = j.id AND status = 'processing'
        ORDER BY started_at DESC
        LIMIT 1
      ) ja ON true
      WHERE j.status = 'processing'
      ORDER BY j.updated_at DESC
      LIMIT 20
    `)
    const processingByQueue: Record<string, { id: string; workerId: string | null; workerHostname: string | null }[]> = {}
    for (const q of queues) processingByQueue[q] = []
    for (const row of processingResult.rows) {
      if (processingByQueue[row.queue_name]) {
        processingByQueue[row.queue_name].push({
          id: row.id,
          workerId: row.worker_id ?? null,
          workerHostname: row.worker_hostname ?? null
        })
      }
    }

    // Attempt stats
    const attemptsResult = await query(`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_attempts,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_attempts,
        ROUND(AVG(execution_time_ms) FILTER (WHERE status = 'completed')) as avg_execution_ms,
        ROUND(AVG(queue_latency_ms)) as avg_latency_ms
      FROM job_attempts
    `)
    const attempts = attemptsResult.rows[0]

    // Recent throughput (last 60 seconds)
    const throughputResult = await query(`
      SELECT COUNT(*) as count
      FROM jobs
      WHERE status = 'completed' AND updated_at > NOW() - INTERVAL '60 seconds'
    `)
    const throughput = parseInt(throughputResult.rows[0].count, 10)

    return {
      jobs: {
        total,
        ...statusCounts
      },
      queues: {
        depths: queueDepths,
        delayed: delayedDepths,
        readyJobs,
        delayedJobs,
        processing: processingByQueue
      },
      attempts: {
        total: parseInt(attempts.total_attempts, 10) || 0,
        successful: parseInt(attempts.successful_attempts, 10) || 0,
        failed: parseInt(attempts.failed_attempts, 10) || 0,
        avg_execution_ms: parseFloat(attempts.avg_execution_ms) || 0,
        avg_latency_ms: parseFloat(attempts.avg_latency_ms) || 0
      },
      throughput_last_60s: throughput
    }
  }
}
