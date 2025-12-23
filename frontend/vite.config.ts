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
    // Output to dist folder
    outDir: 'dist',
    
    // Generate sourcemaps for debugging
    sourcemap: true,
    
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
