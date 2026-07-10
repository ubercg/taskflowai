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
      // Required so the browser (on https://localhost/taskflow/) reaches the
      // Vite HMR websocket through SIGAO's TLS proxy instead of :3000 directly.
      hmr: base !== '/'
        ? {
            protocol: 'wss',
            clientPort: 443,
            path: `${base.replace(/\/$/, '')}/`,
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
