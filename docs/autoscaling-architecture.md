# 📈 Autoscaling & Dynamic Concurrency Architecture

This document describes Pulsar's adaptive autoscaling system, how queue depth dictates concurrency limits, and how workers scale their internal thread-pools (promise workers) dynamically at runtime.

---

## 🚀 Concept Overview (The Interview Perspective)
In high-throughput job processors, fixed-concurrency workers fail to optimize resource usage:
* **Over-provisioning**: Workers sit idle, consuming memory and connection pools when the queue is empty.
* **Under-provisioning**: During traffic spikes, processing lags because workers process items sequentially.

Pulsar solves this using an **Autoscaler Service** that monitors queue backlog in Redis and dynamically pushes target concurrency levels to workers via Pub/Sub.

---

## 🛠️ The Scaling Formula & Math

The Autoscaler runs a periodic tick (default: 5 seconds) for each queue and applies the following logic:

1. **Calculate Backlog (Queue Depth)**: Get the count of items in the Redis Sorted Set:
   $$\text{Queue Depth} = \text{zCard}(\text{queue:queue\_name})$$
2. **Determine Target Concurrency**: Based on a configurable threshold (how many jobs 1 concurrency slot should handle):
   $$\text{Target Concurrency} = \left\lceil \frac{\text{Queue Depth}}{\text{Threshold}} \right\rceil$$
3. **Apply Clamp Limits**: Prevent out-of-control resource allocation:
   $$\text{Target Concurrency} = \max(\text{Min Workers}, \min(\text{Max Workers}, \text{Target Concurrency}))$$
4. **Subtract Fixed Workers**: Workers with `adaptive_scaling = false` are deducted from the concurrency budget.
5. **Publish to Workers**: The remaining target is divided among the active adaptive workers and broadcasted via Redis Pub/Sub.

---

## 🔄 Concurrency Propagation Flow

```mermaid
graph TD
    %% Entities
    Scheduler[Autoscaler Service]
    Redis[Redis ZSet & Pub/Sub]
    Worker1[Worker 1: notifications-worker]
    Worker2[Worker 2: notifications-worker]

    %% Flow
    Scheduler -- "1. zCard(queue:notifications)" --> Redis
    Redis -- "2. Depth: 25" --> Scheduler
    Note over Scheduler: Threshold = 5. Target Concurrency = 5
    Scheduler -- "3. Publish 'pulsar:concurrency_update' {concurrency: 5}" --> Redis
    Redis -- "4. Pub/Sub Broadcast" --> Worker1
    Redis -- "4. Pub/Sub Broadcast" --> Worker2
    
    %% Scaling logic inside workers
    subgraph Worker Concurrency Pool
        Worker1 -- "5. Adjust loop pool size to 5" --> Pool1[Poll & Process Loops]
    end
```

---

## 🧵 Thread Pool Simulation in Javascript
Because NodeJS is single-threaded, concurrency is managed using **Logical Threads** (concurrent asynchronous execution blocks via `Promises` and `SetSets`).

### Dynamic Loop Scaling Mechanism:
* Inside `worker.ts`, the worker listens to `pulsar:concurrency_update` events and invokes `workerService.updateConcurrency`.
* The worker runs a continuous loop that checks the current active tasks list:
```typescript
while (runningInstances.get(workerId)) {
  const concurrency = instanceConcurrency.get(workerId) || 1;
  const tasks = activeTasks.get(workerId); // Set of pending Promises

  if (tasks.size < concurrency) {
    // Spawns a new non-blocking poll-and-process task
    const taskPromise = pollAndProcess(queueName, workerId);
    tasks.add(taskPromise);
    
    // Automatically remove from active set when execution completes
    taskPromise.finally(() => tasks.delete(taskPromise));
  } else {
    // Concurrency limit reached. Yield execution to event loop
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

---

## ❓ Common Interview Questions & Answers

### Q: Why use Redis Pub/Sub instead of workers polling the DB for their settings?
**A**: Polling database tables is highly expensive and doesn't scale. Redis Pub/Sub provides near-instantaneous broadcast ($O(N)$ subscriber notifications) with minimal CPU and memory overhead, ensuring workers adjust within milliseconds of a traffic surge.

### Q: How does JavaScript achieve true concurrency if it is single-threaded?
**A**: It achieves **concurrent I/O-bound concurrency**. Since worker tasks mostly await external operations (network requests, database updates, Redis pops), the single V8 thread can schedule multiple concurrent operations. When one task is blocked awaiting a database query, the V8 event loop switches to execute another task.

### Q: What prevents scaling-down from killing running tasks?
**A**: When the concurrency target drops (e.g., from 5 to 2), the loop check `if (tasks.size < concurrency)` simply stops spawning new promises. The currently executing 5 tasks are allowed to complete gracefully via their `.finally()` handler, which cleans them from the pool. No jobs are killed or interrupted.
