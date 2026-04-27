/**
 * Mapping of job types to specific queues.
 * If a job type is not listed here, it will default to 'default'.
 */
export const QUEUE_MAP: Record<string, string> = {
  email_send: 'notifications',
  invoice_generate: 'billing',
  image_resize: 'media',
  video_processing: 'media'
}

export const DEFAULT_QUEUE = 'default'
