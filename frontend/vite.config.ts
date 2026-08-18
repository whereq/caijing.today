import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['caijing.today', 'www.caijing.today'],
    proxy: {
      '/api': {
        // Docker DNS resolves the 'caijing-api' service alias to the container.
        target: 'http://caijing-api:8000',
        changeOrigin: true,
      },
    },
  },
})
