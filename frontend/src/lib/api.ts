import axios from 'axios';
import Cookies from 'js-cookie';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken') || Cookies.get('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data on unauthorized
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      Cookies.remove('authToken');
      window.location.href = '/signin';
    }
    return Promise.reject(error);
  }
);

export default api;

// API endpoints
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/api/auth/login', credentials),
  
  register: (userData: { username: string; email: string; password: string }) =>
    api.post('/api/auth/register', userData),
  
  forgotPassword: (email: string) =>
    api.post('/api/auth/forgot-password', { email }),
  
  resetPassword: (token: string, newPassword: string) =>
    api.post('/api/auth/reset-password', { token, newPassword }),
};

export const chatAPI = {
  sendMessage: (userInput: string, conversationHistory?: any[]) =>
    api.post('/chat', { userInput, conversationHistory }),
  
  getHistory: () =>
    api.get('/chat/history'),
};

export const leadAPI = {
  research: (query: string, options?: any) =>
    api.post('/api/lead-research', { query, ...options }),
  
  getResults: () =>
    api.get('/api/lead-research/results'),
};

export const analyticsAPI = {
  getStats: () =>
    api.get('/api/analytics/stats'),
  
  getActivity: () =>
    api.get('/api/analytics/activity'),
};