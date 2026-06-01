# 📡 Real-Time Pub/Sub & Websocket Pipeline

This document details the real-time event pipeline of Pulsar, explaining how job updates, attempt failures, and performance metrics flow from distributed workers all the way to the frontend React dashboard in real-time.

---

## 🗺️ Architectural Pipeline

```
┌─────────────────┐       1. Publish Event       ┌────────────────────────┐
│  Worker Node 1  ├─────────────────────────────>│                        │
└─────────────────┘                              │                        │
                                                 │   Redis Pub/Sub        │
┌─────────────────┐       1. Publish Event       │   (pulsar:events)      │
│  Worker Node 2  ├─────────────────────────────>│                        │
└─────────────────┘                              └───────────┬────────────┘
                                                             │
                                                             │ 2. Deliver Message
                                                             ▼
┌─────────────────┐       4. Emit (job_update)   ┌────────────────────────┐
│  React Client   │<─────────────────────────────┤   API Server           │
│  (NextJS UI)    │                              │   (Socket.IO Instance) │
└─────────────────┘                              └────────────────────────┘
         ▲                                                   ▲
         │                                                   │
         └───────────── 5. Emit (stats_update) ──────────────┘
                        (Independent 2s Loop)
```

---

## 🛠️ Step-by-Step Data Flow

### Step 1: Event Generation (Workers)
When a worker starts, completes, or fails a job attempt, it publishes a telemetry payload to the `pulsar:events` Redis channel:
```typescript
redisClient.publish('pulsar:events', JSON.stringify({
  type: 'attempt_update',
  attempt: {
    id: attemptId,
    job_id: jobId,
    business_attempt: job.attempts,
    infra_attempt: job.infra_attempts,
    status: 'completed',
    worker_id: workerId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    execution_time_ms: executionTimeMs
  }
}));
```

---

### Step 2: The Socket.IO Bridge (API Server)
The API server cannot afford to block connection threads. It establishes a dedicated **Redis Subscriber** client that listens for updates and forwards them instantly via WebSockets:
```typescript
const pubSubClient = redisClient.duplicate();
await pubSubClient.connect();

await pubSubClient.subscribe('pulsar:events', async (message) => {
  const eventData = JSON.parse(message);
  // Broadcast to all connected React clients via WebSockets
  io.emit('job_update', eventData);
});
```

---

### Step 3: Telemetry Isolation (Preventing Database DDoS)
Under heavy load (e.g., 5,000 jobs per second), querying PostgreSQL for aggregate stats (total jobs, pending, completed, failures) on every update would cause database CPU spikes. 

Pulsar protects the database by **decoupling** aggregate telemetry from individual job updates:
* **The Solution**: An independent **2-second loop** runs on the API server.
* **The Flow**: It calculates stats once, then broadcasts the pre-aggregated telemetry object to the client:
```typescript
setInterval(async () => {
  try {
    const stats = await statsService.getStats();
    io.emit('stats_update', stats);
  } catch (err) {
    logger.error('Error broadcasting stats update', err);
  }
}, 2000);
```

---

### Step 4: UI Synchronization (React Frontend)
The frontend client uses `socket.io-client` to listen to these streams. 

* **Job Log Feed**: Prepend or update items dynamically in the current view when a `job_update` containing an `attempt_update` is received:
  ```typescript
  useEffect(() => {
    socket.on("job_update", (data) => {
      if (data.type === "attempt_update") {
        setAttempts(prev => {
          const exists = prev.some(a => a.id === data.attempt.id);
          return exists 
            ? prev.map(a => a.id === data.attempt.id ? data.attempt : a)
            : [data.attempt, ...prev];
        });
      }
    });
    return () => socket.off("job_update");
  }, []);
  ```
* **Stats Panel**: Replace the entire dashboard stats object on `stats_update`:
  ```typescript
  useEffect(() => {
    socket.on("stats_update", setStats);
    return () => socket.off("stats_update");
  }, []);
  ```

---

## ❓ Common Interview Questions & Answers

### Q: Why not use WebSockets from the worker nodes directly to the clients?
**A**: Worker nodes run in private subnets, do not expose public endpoints, and scale dynamically. Connecting clients to workers directly would require managing mesh networks, handling massive connection states on process workers, and exposing private infrastructure. The Redis Pub/Sub + API Gateway bridge isolates the workers behind a secure, single-point-of-contact WebSocket server.

### Q: How does the dashboard handle massive spikes of job updates without freezing the browser?
**A**: It uses two techniques:
1. **Aggregated UI Stats**: Detailed database querying is rate-limited to 2-second intervals on the server, avoiding browser repainting storms.
2. **Key-based React List Diffing**: React lists use unique key IDs (`key={att.id}`) to selectively render only updated attempt entries, keeping repaints highly local and lightweight.
