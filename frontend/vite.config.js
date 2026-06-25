import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
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
    proxy: {
      '/api': {
        target: 'http://taskflow_backend:8000',
        changeOrigin: true,
      },
    },
  },
})
