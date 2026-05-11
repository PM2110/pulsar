# 📊 Pulsar Dashboard

This is the frontend monitoring and management interface for the **Pulsar Job Engine**. Built with Next.js 14, it provides a real-time, high-performance dashboard for overseeing background tasks.

## ✨ Features

- 🕒 **Real-time Monitoring**: Live updates via WebSockets (Socket.io).
- 📈 **Performance Analytics**: Visual throughput and latency charts using Recharts.
- 🛠️ **Job Control**: Create, retry, and manage jobs through a clean UI.
- 🧵 **Worker Management**: View and scale worker instances in real-time.
- 📱 **Fully Responsive**: Optimized for all screen sizes.

## 🚀 Getting Started

### Prerequisites
Ensure the Pulsar API server is running (usually on `http://localhost:3000`).

### Installation
```bash
# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) to view the dashboard.

## 🛠️ Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Communication**: Socket.io-client

## 📖 Learn More
For a deep dive into the dashboard architecture and features, see the **[Dashboard Documentation](../docs/dashboard.md)**.
