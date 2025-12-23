/**
 * ==============================================================================
 * NETKNIFE - TAILWIND CSS CONFIGURATION
 * ==============================================================================
 * 
 * Custom Tailwind configuration with:
 * - Terminal/dark theme colors
 * - Custom font families
 * - Extended color palette
 * ==============================================================================
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom colors for terminal aesthetic
      colors: {
        terminal: {
          bg: '#0d1117',
          text: '#c9d1d9',
          muted: '#8b949e',
          green: '#3fb950',
          blue: '#58a6ff',
          red: '#f85149',
          yellow: '#d29922',
          purple: '#a371f7',
        },
      },
      // Custom fonts
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
