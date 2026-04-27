import { query, pool } from '../config/db.config.js'
import { queueService } from '../services/queue.service.js'
import { connectRedis, redisClient } from '../config/redis.config.js'

const JOB_TYPES: Record<string, string[]> = {
  notifications: ['email_send', 'sms_send', 'push_notify'],
  media: ['image_resize', 'video_transcode', 'thumbnail_gen', 'video_extract_audio', 'image_watermark'],
  default: ['data_export', 'report_generate', 'cache_warmup', 'cleanup_task']
}

const ALL_QUEUES = Object.keys(JOB_TYPES)

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomPayload(jobType: string): object {
  const payloads: Record<string, object> = {
    email_send: { to: `user${randomBetween(1, 999)}@example.com`, subject: 'Notification', body: 'Hello!' },
    sms_send: { phone: `+1${randomBetween(1000000000, 9999999999)}`, message: 'Your OTP is ' + randomBetween(1000, 9999) },
    push_notify: { device_token: Math.random().toString(36).slice(2), title: 'New Event', body: 'Tap to open' },
    image_resize: { src: `image_${randomBetween(1, 100)}.jpg`, width: [400, 800, 1200][randomBetween(0, 2)], height: [300, 600, 900][randomBetween(0, 2)] },
    video_transcode: { src: `video_${randomBetween(1, 50)}.mp4`, format: ['mp4', 'webm', 'avi'][randomBetween(0, 2)], quality: ['720p', '1080p', '4k'][randomBetween(0, 2)] },
    thumbnail_gen: { src: `media_${randomBetween(1, 100)}.jpg`, size: [128, 256, 512][randomBetween(0, 2)] },
    video_extract_audio: { src: `video_${randomBetween(1, 50)}.mp4`, format: ['mp3', 'aac', 'wav'][randomBetween(0, 2)] },
    image_watermark: { src: `image_${randomBetween(1, 100)}.jpg`, text: 'Pulsar © 2024', opacity: Math.round(Math.random() * 100) / 100 },
    data_export: { entity: ['users', 'orders', 'products'][randomBetween(0, 2)], format: ['csv', 'json', 'xlsx'][randomBetween(0, 2)] },
    report_generate: { type: ['daily', 'weekly', 'monthly'][randomBetween(0, 2)], period: `2024-${String(randomBetween(1, 12)).padStart(2, '0')}` },
    cache_warmup: { keys: [`cache:user:${randomBetween(1, 1000)}`, `cache:product:${randomBetween(1, 500)}`] },
    cleanup_task: { target: ['tmp_files', 'expired_sessions', 'old_logs'][randomBetween(0, 2)], older_than_days: randomBetween(7, 90) }
  }
  return payloads[jobType] || { task: jobType, id: randomBetween(1, 1000) }
}

const seedJobs = async () => {
  try {
    // Connect to Redis
    await connectRedis()

    // Generate 15 random jobs (Reference: job_data.sql patterns)
    const jobs = Array.from({ length: 15 }).map(() => {
      const queueName = ALL_QUEUES[Math.floor(Math.random() * ALL_QUEUES.length)]
      const jobTypes = JOB_TYPES[queueName] || JOB_TYPES.default
      const jobType = jobTypes[Math.floor(Math.random() * jobTypes.length)]
      const failureMode = (['succeed', 'fail', 'probably_fail', 'probably_fail'])[Math.floor(Math.random() * 4)]
      
      return {
        queue_name: queueName,
        job_type: jobType,
        payload: randomPayload(jobType),
        priority: Math.floor(Math.random() * 11),
        max_attempts: Math.max(1, Math.floor(Math.random() * 5) + 1),
        failure_mode: failureMode,
        fail_probability: failureMode === 'probably_fail' ? Math.round(Math.random() * 10) / 10 : null
      }
    })

    console.log('🌱 Seeding jobs with failure modes...')

    for (const job of jobs) {
      // Insert into PostgreSQL
      // failure_mode and fail_probability are used by the worker for simulation
      const insertQuery = `
        INSERT INTO jobs (
          queue_name, 
          job_type, 
          payload, 
          status, 
          priority, 
          max_attempts, 
          failure_mode,
          fail_probability,
          run_at
        ) 
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, NOW())
        RETURNING *
      `
      const values = [
        job.queue_name,
        job.job_type,
        JSON.stringify(job.payload),
        job.priority,
        job.max_attempts,
        job.failure_mode,
        job.failure_mode === 'probably_fail' ? (job as any).fail_probability : null
      ]

      const result = await query(insertQuery, values)
      const newJob = result.rows[0]

      console.log(`✅ Inserted job ${newJob.id} into database (Queue: ${job.queue_name}, Mode: ${job.failure_mode})`)

      // Synchronize with Redis Queue
      await queueService.enqueueJob(job.queue_name, newJob.id, job.priority)
    }

    console.log('✨ Seeding completed successfully! 10 jobs created with failure scenarios.')
  } catch (error) {
    console.error('❌ Seeding failed:', error)
  } finally {
    // Cleanup connections
    try {
      await pool.end()
      console.log('🔌 Database connection closed')

      if (redisClient.isOpen) {
        await redisClient.quit()
        console.log('🔌 Redis connection closed')
      }
    } catch (err) {
      console.error('⚠️ Error during cleanup:', err)
    }
    process.exit(0)
  }
}

// Execute the seeder
seedJobs()
