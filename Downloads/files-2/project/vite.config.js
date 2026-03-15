import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // Proxy Anthropic API to avoid CORS in dev
    proxy: {
      '/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/anthropic/, ''),
        headers: {
          'anthropic-dangerous-direct-browser-access': 'true'
        }
      }
    }
  },
  build: {
    outDir:    'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] }
      }
    }
  },
  define: { global: 'globalThis' }
})
