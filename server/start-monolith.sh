#!/bin/sh

# Exit immediately if any command fails
set -e

echo "=== PULSAR MONOLITH STARTUP ==="

# 1. Run migrations
echo "Running database migrations..."
node dist/db/migrate.js

echo "Migrations completed successfully. Starting services..."

# 2. Start the API & Socket.IO server in the background
echo "Starting Express API Server..."
NODE_ENV=production node dist/server.js &
API_PID=$!

# 3. Start the Notifications Worker in the background
echo "Starting Notifications Worker..."
QUEUE_NAME=notifications \
WORKER_ID=notifications-worker \
PROCESS_TYPE=both \
NODE_ENV=production \
node dist/worker.js &
NOTIF_PID=$!

# 4. Start the Media Worker in the foreground to keep container alive
echo "Starting Media Worker..."
QUEUE_NAME=media \
WORKER_ID=media-worker \
PROCESS_TYPE=both \
NODE_ENV=production \
node dist/worker.js &
MEDIA_PID=$!

# Handle shutdown signals to stop all spawned processes gracefully
cleanup() {
  echo "Stopping all services..."
  kill $API_PID $NOTIF_PID $MEDIA_PID 2>/dev/null
  wait
  echo "All services stopped."
}

trap cleanup INT TERM

# Wait for all background jobs to finish (which is never, unless they crash or stop)
wait $API_PID $NOTIF_PID $MEDIA_PID
