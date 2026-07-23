import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { normalizeApiError } from './errors';

export { normalizeApiError, getErrorMessage, resolveApiError } from './errors';

// Vacío = misma origen que la página (vital detrás de Nginx o en IP pública).
// Con Vite `base` (/taskflow/) prefixamos la API para que no choque con SIGAO /api.
const baseURL = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/'
    ? import.meta.env.BASE_URL.replace(/\/$/, '')
    : '')
)

const api = axios.create({
  baseURL,
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
    // baseURL may be '' behind nginx — always land on /login of this origin.
    const loginPath = baseURL ? `${baseURL}/login` : '/login';
    if (error.response?.status === 401 && window.location.pathname !== loginPath) {
      window.dispatchEvent(new CustomEvent('session-expired'));
      setTimeout(() => {
        useAuthStore.getState().logout();
        window.location.href = loginPath;
      }, 2000);
    }

    normalizeApiError(error);
    return Promise.reject(error);
  }
);

export default {
  get: api.get,
  post: api.post,
  patch: api.patch,
  delete: api.delete,
};
