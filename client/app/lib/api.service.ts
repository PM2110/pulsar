import axios from 'axios';
import { io } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const socket = io(API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Stats
  getStats: async () => {
    const response = await api.get('/api/stats');
    return response.data;
  },

  // Workers
  getWorkers: async () => {
    const response = await api.get('/api/workers');
    return response.data;
  },
  startWorker: async (workerData: { queue_name: string; worker_id: string }) => {
    const response = await api.post('/api/workers/start', workerData);
    return response.data;
  },
  stopWorker: async (worker_id: string) => {
    const response = await api.post('/api/workers/stop', { worker_id });
    return response.data;
  },
  getAutoscalerConfig: async () => {
    const response = await api.get('/api/workers/autoscaler');
    return response.data;
  },
  updateAutoscalerConfig: async (configData: any) => {
    const response = await api.post('/api/workers/autoscaler', configData);
    return response.data;
  },

  // Jobs
  getJobs: async (params: any) => {
    const response = await api.get('/api/jobs', { params });
    return response.data;
  },
  getJobDetails: async (id: string) => {
    const response = await api.get(`/api/jobs/${id}`);
    return response.data;
  },
  createJob: async (jobData: any) => {
    const response = await api.post('/api/jobs', jobData);
    return response.data;
  },
  deleteJob: async (id: string) => {
    const response = await api.delete(`/api/jobs/${id}`);
    return response.data;
  },
  retryJob: async (id: string) => {
    const response = await api.post(`/api/jobs/${id}/retry`);
    return response.data;
  },

  // Seed
  seedJobs: async (seedData: any) => {
    const response = await api.post('/api/seed', seedData);
    return response.data;
  },

  // Base URL
  getAbsoluteUrl: (path: string) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
  }
};

export default apiService;
