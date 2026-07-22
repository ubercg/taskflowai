import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

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

/**
 * Normalize FastAPI error bodies.
 *
 * Structured (preferred): { detail: { code, detail, ...meta } }
 * Legacy plain string:    { detail: "message" }
 */
export function normalizeApiError(error) {
  const payload = error.response?.data?.detail;
  const isEnvelope =
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'code' in payload;

  error.code = isEnvelope ? payload.code : 'UNKNOWN_ERROR';
  error.detail = isEnvelope
    ? payload.detail
    : (typeof payload === 'string' ? payload : (payload ?? error.message));
  error.meta = isEnvelope ? payload : null;
  return error;
}

/** Human-readable message from a normalized or raw Axios error. */
export function getErrorMessage(error, fallback = 'Error') {
  if (typeof error?.detail === 'string' && error.detail) return error.detail;
  const payload = error?.response?.data?.detail;
  if (typeof payload === 'string' && payload) return payload;
  if (payload && typeof payload === 'object' && typeof payload.detail === 'string') {
    return payload.detail;
  }
  if (Array.isArray(payload)) {
    return payload.map((e) => e.msg || JSON.stringify(e)).join(' ');
  }
  return error?.message || fallback;
}

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
    const loginPath = `${baseURL}/login` || '/login';
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
