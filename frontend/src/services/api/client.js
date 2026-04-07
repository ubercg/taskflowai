import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  // Acceso directo al store sin usar hook
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Removemos hardcodes viejos como X-User-Id si existían globalmente
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.dispatchEvent(new CustomEvent('session-expired'));
      setTimeout(() => {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }, 2000);
    }
    
    // Extraemos códigos de error custom si existen
    const code = error.response?.data?.code || 'UNKNOWN_ERROR';
    const detail = error.response?.data?.detail || error.message;
    
    error.code = code;
    error.detail = detail;
    
    return Promise.reject(error);
  }
);

export default {
  get: api.get,
  post: api.post,
  patch: api.patch,
  delete: api.delete,
};
