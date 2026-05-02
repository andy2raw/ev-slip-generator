import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, /api/prizepicks is rewritten to the PrizePicks origin directly.
      // In production, Vercel routes /api/prizepicks to api/prizepicks.js instead.
      '/api/prizepicks': {
        target: 'https://partner-api.prizepicks.com',
        changeOrigin: true,
        rewrite: () => '/projections?per_page=1000&single_stat=true',
        secure: true,
      },
    },
  },
})
