import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
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
