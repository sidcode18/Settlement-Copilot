import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND_URL = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/reconcile': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/matches': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/chat': {
        target: BACKEND_URL,
        changeOrigin: true,
      }
    }
  }
})
