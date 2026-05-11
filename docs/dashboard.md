# 📊 Pulsar Dashboard

The Pulsar Dashboard is a real-time, interactive monitoring tool built with **Next.js 14**. It provides a comprehensive view of the entire job engine's health and performance.

## 🚀 Key Features

- **Live Telemetry**: Real-time updates on worker status, queue depth, and job progress via WebSockets.
- **Job Management**: Create, retry, or cancel jobs directly from the UI.
- **Worker Overview**: Monitor active worker instances, their thread counts, and current load.
- **Performance Charts**: Visualize throughput and latency using interactive Recharts.
- **Infinite Scrolling**: Efficiently browse through thousands of historical jobs.

---

## 🎨 Design Philosophy

The dashboard is designed for high-density information display without overwhelming the user.
- **Modern UI**: Built with Tailwind CSS and Lucide icons for a clean, professional look.
- **Glassmorphism**: Subtle use of transparency and blurs to create depth.
- **Responsive**: Fully functional on mobile and desktop devices.

---

## 🔌 Communication (WebSockets)

The dashboard maintains a persistent connection to the API server using **Socket.io**.

### Event Types
| Event | Direction | Description |
| :--- | :--- | :--- |
| `stats:update` | Server -> Client | Periodic broadcast of global engine statistics. |
| `job:status` | Server -> Client | Real-time update when a specific job changes state. |
| `worker:heartbeat`| Server -> Client | Updates the list of active worker instances. |
| `job:create` | Client -> Server | Request to seed a new job (alternative to REST API). |

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Vanilla CSS + Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **State Management**: React Hooks (SWR/TanStack Query patterns)
- **Real-time**: Socket.io-client

---

## 🗺️ Page Structure

### 1. Main Overview (`/`)
The primary landing page featuring:
- **Global Stats**: Total jobs, active workers, and queue depth.
- **Throughput Chart**: Jobs processed per minute.
- **Recent Jobs**: A live-updating list of the latest job activities.

### 2. Jobs List (`/jobs`)
A dedicated page for exploring historical jobs with filtering and search capabilities.

### 3. Workers Registry (`/workers`)
Shows all currently registered worker instances, their current status (Idle/Busy), and their assigned thread counts.

---

## 🔧 Local Development

To run the dashboard independently of the backend (assuming the backend is already running on port 3000):

```bash
cd client
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3001`.
