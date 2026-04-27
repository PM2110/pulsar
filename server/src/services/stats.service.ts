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

    for (const q of queues) {
      queueDepths[q] = await redisClient.zCard(`queue:${q}`)
      delayedDepths[q] = await redisClient.zCard(`delayed:queue:${q}`)
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
        delayed: delayedDepths
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
