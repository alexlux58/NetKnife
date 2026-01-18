/**
 * ==============================================================================
 * NETKNIFE - VITE CONFIGURATION
 * ==============================================================================
 * 
 * Vite build configuration for React + TypeScript frontend.
 * ==============================================================================
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // Build configuration
  build: {
    outDir: 'dist',
    // Disable source maps in production to avoid exposing source (security product)
    sourcemap: false,
    
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          auth: ['oidc-client-ts'],
        },
      },
    },
  },
  
  // Development server
  server: {
    port: 3000,
    host: true,
  },
})
