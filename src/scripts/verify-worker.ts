import { env } from '../config/env.config.js'
import { connectRedis } from '../config/redis.config.js'
import { query } from '../config/db.config.js'
import { queueService } from '../services/queue.service.js'
import { DEFAULT_QUEUE } from '../config/queue.config.js'

async function runTest() {
  console.log('🧪 Starting Worker Verification Test...')

  try {
    await connectRedis()

    // Create a few jobs in the DB
    console.log('📝 Creating test jobs...')

    const jobs = [
      { type: 'test-high', priority: 10, payload: { msg: 'High priority job' } },
      { type: 'test-low', priority: 1, payload: { msg: 'Low priority job' } },
      { type: 'test-med', priority: 5, payload: { msg: 'Medium priority job' } },
    ]

    for (const job of jobs) {
      const result = await query(
        'INSERT INTO jobs (queue_name, job_type, payload, status, priority) VALUES ($1, $2, $3, \'pending\', $4) RETURNING id',
        ['notifications', job.type, JSON.stringify(job.payload), job.priority]
      )
      const jobId = result.rows[0].id

      // Enqueue in Redis
      await queueService.enqueueJob('notifications', jobId, job.priority)
      console.log(`✅ Job ${jobId} (${job.type}) created and enqueued.`)
    }

    console.log('Done! Now run "pnpm run worker" to process these jobs.')
    process.exit(0)
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

runTest()
