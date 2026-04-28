import { z } from 'zod'

export const startWorkerSchema = z.object({
  queue_name: z.string().optional().default('default'),
  worker_id: z.string().min(1, 'Worker ID is required')
})

export const stopWorkerSchema = z.object({
  worker_id: z.string().min(1, 'Worker ID is required')
})

export const updateAutoscalerConfigSchema = z.object({
  queue_name: z.string().min(1, 'Queue name is required'),
  config: z.object({
    enabled: z.boolean().optional(),
    minWorkers: z.number().int().min(0).optional(),
    maxWorkers: z.number().int().min(1).optional(),
    threshold: z.number().int().min(1).optional()
  })
})
