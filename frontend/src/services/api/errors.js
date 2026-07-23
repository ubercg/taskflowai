/**
 * API error envelope helpers (TSK-017 / TSK-021).
 *
 * Kept outside `client.js` so authStore (and other non-axios callers) can
 * normalize + translate without importing the axios instance (circular dep).
 */
import i18n from '../../i18n';

/**
 * Normalize FastAPI error bodies onto the Error/Axios object.
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

/**
 * Human-readable message from a normalized or raw Axios error (no i18n).
 * Prefer {@link resolveApiError} for UI.
 */
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

/**
 * Resolve a user-facing API error for the active locale (RN-013).
 *
 * 1. If `error.code` has `errors.{code}` → translate with meta interpolation.
 * 2. Else if `error.detail` is a non-empty string → use it (RN-007 fallback).
 * 3. Else if `fallbackKey` exists → `i18n.t(fallbackKey)`.
 * 4. Else → `errors.UNKNOWN_ERROR`.
 *
 * `suggestion` from the backend is discarded (Spanish prose); the catalog
 * owns the full message for codes like HAS_ACTIVE_TASKS.
 *
 * Works outside React (stores, plain modules) via the i18n singleton.
 */
export function resolveApiError(error, fallbackKey) {
  if (error && !error.code && error.response) {
    normalizeApiError(error);
  }

  const code = error?.code;
  const key = code && code !== 'UNKNOWN_ERROR' ? `errors.${code}` : null;

  if (key && i18n.exists(key)) {
    const meta = error.meta && typeof error.meta === 'object' ? { ...error.meta } : {};
    delete meta.suggestion;
    delete meta.code;
    delete meta.detail;
    return i18n.t(key, meta);
  }

  if (typeof error?.detail === 'string' && error.detail.trim()) {
    return error.detail;
  }

  if (fallbackKey && i18n.exists(fallbackKey)) {
    return i18n.t(fallbackKey);
  }
  if (typeof fallbackKey === 'string' && fallbackKey && !fallbackKey.includes('.')) {
    return fallbackKey;
  }

  return i18n.t('errors.UNKNOWN_ERROR');
}
