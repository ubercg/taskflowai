import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'theme-storage'
const DEFAULT_THEME = 'dark' // dark-first, estética Raycast

/** Aplica el tema como atributo data-theme sobre <html>. */
function applyTheme(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export const useThemeStore = create(persist(
  (set, get) => ({
    theme: DEFAULT_THEME,

    setTheme: (theme) => {
      applyTheme(theme)
      set({ theme })
    },

    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      set({ theme: next })
    },
  }),
  {
    name: STORAGE_KEY,
    onRehydrateStorage: () => (state) => {
      // Al rehidratar desde localStorage, sincroniza el atributo del DOM.
      applyTheme(state?.theme ?? DEFAULT_THEME)
    },
  }
))

export const useTheme = () => useThemeStore()

/**
 * Init síncrono antes del primer render para evitar el "flash" de tema.
 * Lee localStorage directo (sin esperar la rehidratación de zustand) y
 * fija data-theme. Cae a dark por default.
 */
export function initTheme() {
  let theme = DEFAULT_THEME
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      theme = parsed?.state?.theme ?? DEFAULT_THEME
    }
  } catch {
    theme = DEFAULT_THEME
  }
  applyTheme(theme)
}
