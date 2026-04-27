import { query, pool } from '../config/db.config.js'
import { queueService } from '../services/queue.service.js'
import { connectRedis, redisClient } from '../config/redis.config.js'

const seedJobs = async () => {
  try {
    // Connect to Redis
    await connectRedis()

    // Define jobs to seed (Reference: job_data.sql patterns)
    const jobs = [
      // 5 Notification Jobs
      { queue_name: 'notifications', job_type: 'email_send', payload: { to: 'user1@example.com', body: 'Welcome!' }, priority: 1, max_attempts: 3, failure_mode: 'succeed' },
      { queue_name: 'notifications', job_type: 'sms_send', payload: { phone: '+1234567890', message: 'Your OTP is 1234' }, priority: 10, max_attempts: 3, failure_mode: 'fail' },
      { queue_name: 'notifications', job_type: 'push_notify', payload: { device_token: 'abc', title: 'New Message' }, priority: 5, max_attempts: 3, failure_mode: 'probably_fail', fail_probability: 0.9 },
      { queue_name: 'notifications', job_type: 'email_send', payload: { to: 'user2@example.com', body: 'Monthly Statement' }, priority: 7, max_attempts: 3, failure_mode: 'probably_fail', fail_probability: 0.3 },
      { queue_name: 'notifications', job_type: 'sms_send', payload: { phone: '+1987654321', message: 'Delivery Alert' }, priority: 3, max_attempts: 3, failure_mode: 'probably_fail', fail_probability: 0.3 },

      // 5 Media Jobs
      { queue_name: 'media', job_type: 'image_resize', payload: { src: 'img1.jpg', width: 800 }, priority: 1, max_attempts: 5, failure_mode: 'succeed' },
      { queue_name: 'media', job_type: 'video_transcode', payload: { src: 'vid1.mp4', format: 'mp4' }, priority: 8, max_attempts: 2, failure_mode: 'fail' },
      { queue_name: 'media', job_type: 'thumbnail_gen', payload: { src: 'img2.png' }, priority: 4, max_attempts: 3, failure_mode: 'probably_fail', fail_probability: 0.5 },
      { queue_name: 'media', job_type: 'video_extract_audio', payload: { src: 'vid2.mov' }, priority: 2, max_attempts: 3, failure_mode: 'probably_fail', fail_probability: 0.1 },
      { queue_name: 'media', job_type: 'image_watermark', payload: { src: 'img3.jpg', text: 'Copyright' }, priority: 6, max_attempts: 4, failure_mode: 'probably_fail', fail_probability: 0.7 },
    ]

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
