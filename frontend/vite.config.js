import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Docker compose sets VITE_BASE_PATH in the process env; loadEnv only reads .env files.
  const base = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [react(), tailwindcss()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: ['201.147.245.201', 'localhost'],
      // Behind SIGAO at http(s)://host/taskflow/: HMR must use the public
      // origin port. Do NOT set `path` to the base — Vite already prefixes
      // with `base`, and path=/taskflow/ produced /taskflow/taskflow/.
      // Default to ws/:80 (HTTP prod). Override with VITE_HMR_* for TLS.
      hmr: base !== '/'
        ? {
            protocol: process.env.VITE_HMR_PROTOCOL || 'ws',
            clientPort: Number(process.env.VITE_HMR_CLIENT_PORT || 80),
          }
        : undefined,
      proxy: {
        '/api': {
          target: 'http://taskflow_backend:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
