# API Reference

All requests and responses use JSON.

## Health Check

### `GET /health`
Returns the status of the server and basic system information.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-04-21T15:00:00.000Z",
  "uptime": 123.45,
  "env": "development"
}
```

---

## Jobs

### `POST /api/jobs`
Creates a new background job.

**Request Body:**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `job_type` | `string` | Yes | Type of job (e.g., `email_send`) |
| `payload` | `object` | Yes | Data needed for the job |
| `queue_name`| `string` | No | Target queue (auto-mapped if omitted) |
| `priority` | `number` | No | Default: `0`. Higher is more urgent. |
| `max_attempts`| `number` | No | Default: `3`. |
| `run_at` | `ISO Date`| No | When the job should be processed. |

**Example Request:**
```json
{
  "job_type": "email_send",
  "payload": {
    "to": "user@example.com",
    "subject": "Welcome!"
  }
}
```

**Response (201 Created):**
```json
{
  "message": "Job created successfully",
  "job": {
    "id": "1",
    "queue_name": "notifications",
    "job_type": "email_send",
    "payload": { ... },
    "status": "pending",
    "priority": 0,
    "attempts": 0,
    "max_attempts": 3,
    "run_at": "2024-04-21T12:30:00.000Z",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

## Error Protocol
Errors follow this standard response structure:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "timestamp": "...",
  "path": "/api/jobs"
}
```
