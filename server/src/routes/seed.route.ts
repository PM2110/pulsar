import { Router, Request, Response, NextFunction } from 'express'
import { query } from '../config/db.config.js'
import { queueService } from '../services/queue.service.js'

const router: Router = Router()

const JOB_TYPES: Record<string, string[]> = {
  notifications: ['email_send', 'sms_send', 'push_notify'],
  media: ['image_resize', 'video_transcode', 'thumbnail_gen', 'video_extract_audio', 'image_watermark'],
  // default: ['data_export', 'report_generate', 'cache_warmup', 'cleanup_task']
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
    // data_export: { entity: ['users', 'orders', 'products'][randomBetween(0, 2)], format: ['csv', 'json', 'xlsx'][randomBetween(0, 2)] },
    // report_generate: { type: ['daily', 'weekly', 'monthly'][randomBetween(0, 2)], period: `2024-${String(randomBetween(1, 12)).padStart(2, '0')}` },
    // cache_warmup: { keys: [`cache:user:${randomBetween(1, 1000)}`, `cache:product:${randomBetween(1, 500)}`] },
    // cleanup_task: { target: ['tmp_files', 'expired_sessions', 'old_logs'][randomBetween(0, 2)], older_than_days: randomBetween(7, 90) }
  }
  return payloads[jobType] || { task: jobType, id: randomBetween(1, 1000) }
}

/**
 * POST /api/seed
 * Seeds N random jobs into the specified queue(s).
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      count = 10,
      queue_name,
      failure_mode,
      fail_probability
    } = req.body

    const jobCount = Math.min(Math.max(parseInt(count, 10) || 10, 1), 100)
    const createdJobs: any[] = []

    for (let i = 0; i < jobCount; i++) {
      // Pick a random queue if not specified
      const queueName = queue_name || ALL_QUEUES[randomBetween(0, ALL_QUEUES.length - 1)]
      const jobTypes = JOB_TYPES[queueName] || JOB_TYPES.default
      const jobType = jobTypes[randomBetween(0, jobTypes.length - 1)]
      const priority = randomBetween(0, 10)
      const maxAttempts = Math.max(1, randomBetween(1, 5))
      const failureMode = failure_mode || (['succeed', 'fail', 'probably_fail', 'probably_fail'])[randomBetween(0, 3)]
      const failProb = failureMode === 'probably_fail'
        ? (fail_probability !== undefined ? parseFloat(fail_probability) : Math.round(Math.random() * 10) / 10)
        : null
      const payload = randomPayload(jobType)

      const insertQuery = `
        INSERT INTO jobs (
          queue_name, job_type, payload, status, priority,
          max_attempts, failure_mode, fail_probability, run_at
        )
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, NOW())
        RETURNING *
      `

      const result = await query(insertQuery, [
        queueName, jobType, JSON.stringify(payload),
        priority, maxAttempts, failureMode, failProb
      ])

      const newJob = result.rows[0]
      await queueService.enqueueJob(queueName, newJob.id, priority)
      createdJobs.push(newJob)
    }

    res.status(201).json({
      message: `Successfully seeded ${createdJobs.length} jobs`,
      count: createdJobs.length,
      jobs: createdJobs
    })
  } catch (err) {
    next(err)
  }
})

export default router
