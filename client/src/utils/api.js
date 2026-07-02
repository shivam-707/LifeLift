/**
 * PeakMode — Axios API Utility
 * ──────────────────────────────
 * Creates a pre-configured Axios instance that:
 *  · Points to the backend base URL
 *  · Automatically attaches the JWT from localStorage on every request
 *  · Handles 401 responses by clearing stale auth data
 */

import axios from 'axios';

// Base URL: in development the CRA proxy forwards /api/* to localhost:5000.
// In production set REACT_APP_API_URL to your deployed backend URL.
const BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach Bearer token ─────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('peakmode_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle expired / invalid tokens ────────────────────
api.interceptors.response.use(
  (response) => response, // pass through successful responses
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid or expired — wipe local auth state
      localStorage.removeItem('peakmode_token');
      localStorage.removeItem('peakmode_user');
      // Redirect to login (only if not already there)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth API helpers ──────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  getMe:    ()     => api.get('/auth/me'),
};

export default api;
