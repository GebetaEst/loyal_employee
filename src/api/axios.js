import axios from 'axios';
import { useStore } from '../store/useStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('emp_session');
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${session.token}`;
      }
    }
  } catch (err) {
    console.error('Error parsing emp_session in Axios request interceptor:', err);
  }
  return config;
});

// On 401 → clear session but KEEP employeeId so the user just re-enters password
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const employeeId = localStorage.getItem('emp_saved_id');
      useStore.getState().clearAuthKeepEmployee(employeeId);
    }
    return Promise.reject(error);
  }
);

export default api;
