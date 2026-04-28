import { z } from 'zod'

export const seedJobsSchema = z.object({
  count: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseInt(v, 10) : v).optional().default(10),
  queue_name: z.string().optional(),
  failure_mode: z.enum(['succeed', 'fail', 'probably_fail']).optional(),
  fail_probability: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? parseFloat(v) : v).optional()
})
