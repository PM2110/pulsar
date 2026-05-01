import { query, pool } from '../config/db.config.js'
import { queueService } from './queue.service.js'

/**
 * Service to handle the Transactional Outbox Pattern.
 * Ensures atomicity between database changes and external side effects.
 */
export const outboxService = {
  /**
   * Adds an entry to the outbox table.
   * Acceptance of an optional client allows it to be part of an external transaction.
   */
  async addEntry(eventType: string, payload: any, client?: any) {
    const q = client ? client.query.bind(client) : query
    const insertQuery = `
      INSERT INTO outbox (event_type, payload, status)
      VALUES ($1, $2, 'pending')
      RETURNING id
    `
    const result = await q(insertQuery, [eventType, payload])
    return result.rows[0].id
  },

  /**
   * Relays pending outbox entries to their respective handlers.
   * Uses row-level locking (FOR UPDATE SKIP LOCKED) for safe concurrent processing.
   */
  async relayPendingEntries() {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      
      // Fetch pending entries with a lock
      const selectQuery = `
        SELECT * FROM outbox 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 50 
        FOR UPDATE SKIP LOCKED
      `
      const { rows } = await client.query(selectQuery)

      if (rows.length === 0) {
        await client.query('COMMIT')
        return
      }

      for (const entry of rows) {
        try {
          if (entry.event_type === 'job_enqueue') {
            const { job_id, queue_name, priority } = entry.payload
            await queueService.enqueueJob(queue_name, job_id, priority)
          }

          // Mark as processed successfully
          await client.query(
            `UPDATE outbox 
             SET status = 'processed', 
                 processed_at = NOW(), 
                 updated_at = NOW() 
             WHERE id = $1`,
            [entry.id]
          )
        } catch (err: any) {
          console.error(`❌ Outbox Relay: Failed to process entry ${entry.id}:`, err.message)
          
          // Increment retry count and log error
          await client.query(
            `UPDATE outbox 
             SET retry_count = retry_count + 1, 
                 last_error = $1, 
                 updated_at = NOW(),
                 status = CASE WHEN retry_count + 1 >= 10 THEN 'failed' ELSE status END
             WHERE id = $2`,
            [err.message, entry.id]
          )
        }
      }

      await client.query('COMMIT')
    } catch (err) {
      if (client) await client.query('ROLLBACK')
      console.error('❌ Outbox Relay Error:', err)
    } finally {
      client.release()
    }
  }
}
