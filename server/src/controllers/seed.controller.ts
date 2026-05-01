import { Request, Response, NextFunction } from 'express'
import { getClient } from '../config/db.config.js'
import { outboxService } from '../services/outbox.service.js'

const JOB_TYPES: Record<string, string[]> = {
  notifications: ['email_send', 'sms_send', 'push_notify'],
  media: ['image_resize', 'video_transcode', 'thumbnail_gen', 'video_extract_audio', 'image_watermark'],
}

const ALL_QUEUES = Object.keys(JOB_TYPES)

/**
 * Derives a random integer between two specified extents.
 */
const randomBetween = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Builds mock test payload shapes aligned perfectly with the intended processing logic requirements.
 */
const randomPayload = (jobType: string): object => {
  const payloads: Record<string, object> = {
    email_send: { to: `user${randomBetween(1, 999)}@example.com`, subject: 'Notification', body: 'Hello!' },
    sms_send: { phone: `+1${randomBetween(1000000000, 9999999999)}`, message: 'Your OTP is ' + randomBetween(1000, 9999) },
    push_notify: { device_token: Math.random().toString(36).slice(2), title: 'New Event', body: 'Tap to open' },
    image_resize: { src: `image_${randomBetween(1, 100)}.jpg`, width: [400, 800, 1200][randomBetween(0, 2)], height: [300, 600, 900][randomBetween(0, 2)] },
    video_transcode: { src: `video_${randomBetween(1, 50)}.mp4`, format: ['mp4', 'webm', 'avi'][randomBetween(0, 2)], quality: ['720p', '1080p', '4k'][randomBetween(0, 2)] },
    thumbnail_gen: { src: `media_${randomBetween(1, 100)}.jpg`, size: [128, 256, 512][randomBetween(0, 2)] },
    video_extract_audio: { src: `video_${randomBetween(1, 50)}.mp4`, format: ['mp3', 'aac', 'wav'][randomBetween(0, 2)] },
    image_watermark: { src: `image_${randomBetween(1, 100)}.jpg`, text: 'Pulsar © 2024', opacity: Math.round(Math.random() * 100) / 100 },
  }
  return payloads[jobType] || { task: jobType, id: randomBetween(1, 1000) }
}

/**
 * Encapsulates the operations to inject mocked payload streams manually directly testing worker integrity logic.
 */
export const seedController = {
  /**
   * Controller API translating a batch seed request mimicking standard job ingestion workflows natively.
   */
  seedJobs: async (req: Request, res: Response, next: NextFunction) => {
    let client;
    try {
      const {
        count,
        queue_name,
        failure_mode,
        fail_probability
      } = req.body

      const jobCount = Math.min(Math.max(count || 10, 1), 100)
      const createdJobs: any[] = []

      client = await getClient()
      await client.query('BEGIN')

      for (let i = 0; i < jobCount; i++) {
        const queueName = queue_name || ALL_QUEUES[randomBetween(0, ALL_QUEUES.length - 1)]
        const jobTypes = JOB_TYPES[queueName] || JOB_TYPES.default
        const jobType = jobTypes[randomBetween(0, jobTypes.length - 1)]
        const priority = randomBetween(0, 10)
        const maxAttempts = Math.max(1, randomBetween(1, 5))
        const failureMode = failure_mode || (['succeed', 'fail', 'probably_fail', 'probably_fail'])[randomBetween(0, 3)]
        const failProb = failureMode === 'probably_fail'
          ? (fail_probability !== undefined ? fail_probability : Math.round(Math.random() * 10) / 10)
          : null
        const payload = randomPayload(jobType)

        // 2. Insert the job into the primary 'jobs' table
        const insertQuery = `
          INSERT INTO jobs (
            queue_name, job_type, payload, status, priority,
            max_attempts, failure_mode, fail_probability, run_at
          )
          VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, NOW())
          RETURNING *
        `

        const result = await client.query(insertQuery, [
          queueName, jobType, JSON.stringify(payload),
          priority, maxAttempts, failureMode, failProb
        ])


        const newJob = result.rows[0]
        createdJobs.push(newJob)

        // 3. Atomic side effect: Add to outbox in the same transaction.
        // This ensures that the job creation and the notification to the relay
        // are committed together, preventing data inconsistency.
        await outboxService.addEntry('job_enqueue', {
          job_id: newJob.id,
          queue_name: newJob.queue_name,
          priority: newJob.priority
        }, client)
      }

      // 4. Commit the transaction.
      // Once committed, the jobs are visible in the DB, and the outbox entry 
      // is ready to be picked up by the Outbox Relay.
      await client.query('COMMIT')
      console.log(`✅ Transaction committed. Created ${createdJobs.length} jobs and outbox entries.`)
      
      res.status(201).json({
        message: `Successfully seeded ${createdJobs.length} jobs via Outbox`,
        count: createdJobs.length,
        jobs: createdJobs
      })
    } catch (err) {
      // If anything fails, rollback the entire transaction to maintain atomicity.
      if (client) await client.query('ROLLBACK')
      next(err)
    } finally {
      if (client) client.release()
    }
  }
}

export const { seedJobs } = seedController
