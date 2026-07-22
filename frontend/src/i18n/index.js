import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import es from './locales/es.json'
import en from './locales/en.json'

export const SUPPORTED_LOCALES = ['es', 'en']
export const DEFAULT_LOCALE = 'es'
export const LOCALE_STORAGE_KEY = 'locale-storage'

/**
 * Read the persisted locale before React mounts.
 * Invalid / unsupported values fall back to DEFAULT_LOCALE (RN-006 / RN-005).
 */
export function readStoredLocale() {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (!raw) return DEFAULT_LOCALE
    const parsed = JSON.parse(raw)
    const lng = parsed?.state?.locale
    return SUPPORTED_LOCALES.includes(lng) ? lng : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
}

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: readStoredLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  // Explicit: no browser LanguageDetector (REQ-009 RN-006).
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
