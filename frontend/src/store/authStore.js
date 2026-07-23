import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import { normalizeApiError, resolveApiError } from '../services/api/errors'

export const useAuthStore = create(persist(
  (set) => ({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (email, password) => {
      set({ isLoading: true, error: null })
      try {
        const params = new URLSearchParams()
        params.append('username', email)
        params.append('password', password)

        const base = (
          import.meta.env.VITE_API_URL ??
          (import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/'
            ? import.meta.env.BASE_URL.replace(/\/$/, '')
            : '')
        )
        const response = await axios.post(
          `${base}/api/v1/auth/login`,
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        )
        
        const { access_token, user } = response.data
        set({ 
          token: access_token, 
          user: user, 
          isAuthenticated: true, 
          isLoading: false 
        })
      } catch (err) {
        normalizeApiError(err)
        const msg = resolveApiError(err, 'errors.LOGIN_FAILED')
        set({ error: msg, isLoading: false })
        throw err
      }
    },

    logout: () => {
      set({ token: null, user: null, isAuthenticated: false, error: null })
      window.location.href = '/login'
    },

    setUser: (user) => set({ user }),
    
    clearError: () => set({ error: null })
  }),
  {
    name: 'auth-storage', // key in localStorage
  }
))

export const useAuth = () => useAuthStore()
