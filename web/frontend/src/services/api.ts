import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.config && !error.config._retry) {
      error.config._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await authApi.refresh(refreshToken);
          const { token, refreshToken: newRefreshToken } = response.data;
          
          localStorage.setItem('token', token);
          localStorage.setItem('refreshToken', newRefreshToken);
          
          error.config.headers.Authorization = `Bearer ${token}`;
          return api(error.config);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// API endpoints
export const authApi = {
  login: (username: string, password: string) => 
    api.post('/auth/login', { username, password }),
  refresh: (refreshToken: string) => 
    api.post('/auth/refresh', { refreshToken }),
  logout: () => api.post('/auth/logout'),
};

export const containerApi = {
  list: (params?: { nvr?: string; status?: string }) => 
    api.get('/containers', { params }),
  get: (id: string) => api.get(`/containers/${id}`),
  start: (id: string) => api.post(`/containers/${id}/start`),
  stop: (id: string) => api.post(`/containers/${id}/stop`),
  restart: (id: string) => api.post(`/containers/${id}/restart`),
  logs: (id: string, params?: { tail?: number; since?: string }) => 
    api.get(`/containers/${id}/logs`, { params }),
  stats: (id: string) => api.get(`/containers/${id}/stats`),
};

export const nvrApi = {
  list: () => api.get('/nvrs'),
  create: (data: any) => api.post('/nvrs', data),
  get: (id: string) => api.get(`/nvrs/${id}`),
  discover: (id: string) => api.post(`/nvrs/${id}/discover`),
  generateConfig: (id: string, data: any) => 
    api.post(`/nvrs/${id}/generate-config`, data),
};

export const metricsApi = {
  system: () => api.get('/metrics/system'),
  containers: (params?: any) => api.get('/metrics/containers', { params }),
  history: (params: { metric: string; from: string; to: string; interval?: string }) => 
    api.get('/metrics/history', { params }),
};

export default api;