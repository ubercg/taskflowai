import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import i18n, {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
} from '../i18n'

export const useLocaleStore = create(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,

      setLocale: (locale) => {
        const next = normalizeLocale(locale)
        void i18n.changeLanguage(next)
        set({ locale: next })
      },
    }),
    {
      name: LOCALE_STORAGE_KEY,
      // Drop unsupported values left over from experiments / typos.
      merge: (persisted, current) => {
        const raw = persisted?.locale
        const locale = normalizeLocale(raw)
        if (locale !== i18n.language) {
          void i18n.changeLanguage(locale)
        }
        return { ...current, ...persisted, locale }
      },
    },
  ),
)

export const useLocale = () => useLocaleStore()
