import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/prizepicks': {
        target: 'https://partner-api.prizepicks.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/prizepicks/, ''),
        secure: true,
      },
    },
  },
})
