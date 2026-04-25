import { z } from 'zod'

export const createJobSchema = z.object({
  queue_name: z.string().max(100).optional(),
  job_type: z.string().min(1).max(100),
  payload: z.any(),
  priority: z.number().int().min(0).optional().default(0),
  max_attempts: z.number().int().min(1).optional().default(3),
  run_at: z.string().datetime().optional().nullable(),
  failure_mode: z.enum(['succeed', 'fail', 'probably_fail']).optional().default('probably_fail'),
  fail_probability: z.number().min(0).max(1).optional().default(0.3)
})

export type CreateJobInput = z.infer<typeof createJobSchema>

export const updateJobSchema = createJobSchema.partial().extend({
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional()
})

export type UpdateJobInput = z.infer<typeof updateJobSchema>
