import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/price': {
        target: 'https://api.ponzi.land',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
      },
      '/api/usernames': {
        target: 'https://socialink.ponzi.land', // Target Socialink API
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/usernames/, '/api/user/lookup'), // Rewrite path
        secure: false 
      }
    }
  }
})
