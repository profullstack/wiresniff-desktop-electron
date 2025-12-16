/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // WireSniff Dark Theme Colors
        'dark-bg': '#1a1d23',
        'dark-surface': '#23262e',
        'dark-border': '#2d3139',
        'accent-blue': '#00d9ff',
        'accent-teal': '#14b8a6',
        // Alternative naming from mockups
        'ws-dark': '#1a1d23',
        'ws-darker': '#13151a',
        'ws-accent': '#00d4ff',
        'ws-accent-hover': '#00b8e6',
        'ws-border': '#2a2d35',
        'ws-surface': '#21242b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 217, 255, 0.3)',
        'glow-sm': '0 0 10px rgba(0, 217, 255, 0.2)',
      },
    },
  },
  plugins: [],
};