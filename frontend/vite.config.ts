/**
 * ==============================================================================
 * NETKNIFE - VITE CONFIGURATION
 * ==============================================================================
 * 
 * Vite build configuration for React + TypeScript frontend.
 * ==============================================================================
 */

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Dev: merge .env.production (API URL) with .env.development.local (localhost OAuth)
  const env = {
    ...loadEnv('production', process.cwd(), 'VITE_'),
    ...loadEnv(mode, process.cwd(), 'VITE_'),
  }

  return {
  plugins: [react()],
  envPrefix: 'VITE_',
  
  // Build configuration
  build: {
    outDir: 'dist',
    // Disable source maps in production to avoid exposing source (security product)
    sourcemap: false,
    
    // Chunk splitting for better caching.
    // Vite 8 (rolldown) requires manualChunks to be a function; the object
    // form is no longer supported.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) {
            return 'vendor'
          }
          if (id.includes('oidc-client-ts')) return 'auth'
        },
      },
    },
  },
  
  // Development server
  server: {
    port: 3000,
    host: true,
    proxy: env.VITE_API_URL
      ? {
          '/__api': {
            target: env.VITE_API_URL,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/__api/, ''),
          },
        }
      : undefined,
  },
  }
})
