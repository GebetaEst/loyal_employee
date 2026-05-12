import axios from 'axios';
import { useStore } from '../store/useStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('emp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 → clear token but KEEP employeeId so the user just re-enters password
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const employeeId = localStorage.getItem('emp_employee_id');
      localStorage.removeItem('emp_token');
      // Keep emp_employee_id so the login page can pre-fill / auto-use it
      useStore.getState().clearAuthKeepEmployee(employeeId);
    }
    return Promise.reject(error);
  }
);

export default api;
