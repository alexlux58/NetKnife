/**
 * ==============================================================================
 * NETKNIFE - APPLICATION ENTRY POINT
 * ==============================================================================
 * 
 * This file is the entry point for the React application.
 * It sets up:
 * - React 18's createRoot API for concurrent features
 * - React Router for client-side routing
 * - Global CSS imports
 * 
 * The application uses:
 * - React Router for SPA navigation
 * - OIDC-client-ts for Cognito authentication
 * - Tailwind CSS for styling
 * - React Hook Form + Zod for form handling
 * ==============================================================================
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import './index.css'

// Get the root element
const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found. Make sure index.html has <div id="root"></div>')
}

// Create React root and render app
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

