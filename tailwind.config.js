/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'DM Sans', 'system-ui', 'sans-serif'],
        heading: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Carbon Ledger — dark surfaces
        carbon: {
          950: '#0a0b0d',
          900: '#111318',
          800: '#181c22',
          700: '#1f2430',
          600: '#262c38',
        },
        // Olive-green accent
        brand: {
          50:  '#f5f9ee',
          100: '#e6f1d0',
          200: '#cde3a3',
          300: '#aece70',
          400: '#8db943',
          500: '#659a2b', // Dark mode accent
          600: '#527a22', // Light mode accent
          700: '#3f5e1a',
          800: '#2e4513',
          900: '#1e2d0c',
          950: '#0f1806',
        },
        // Parchment — light mode surfaces
        parchment: {
          50:  '#fafaf6',
          100: '#f4f5f0',
          200: '#eaebe5',
          300: '#dfe0d9',
          400: '#cccec5',
          500: '#b2b5aa',
        },
        base:      'var(--bg-main)',
        surface:   'var(--bg-surface)',
        secondary: 'var(--bg-secondary)',
        elevated:  'var(--bg-elevated)',
        border:    'var(--border)',
        'border-mid': 'var(--border-mid)',
        'text-heading': 'var(--text-heading)',
        'text-body':    'var(--text-body)',
        'text-muted':   'var(--text-muted)',
        accent: {
          DEFAULT: 'var(--accent)',
          dim:     'var(--accent-dim)',
          glow:    'var(--accent-glow)',
          green:   '#659a2b',
          amber:   '#c98a2a',
          rose:    '#c4445a',
          sky:     '#3d82c9',
          neutral: '#6a6866',
        },
        navy: {
          900: '#0a0b0d',
          950: '#060709',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        }
      }
    },
  },
  plugins: [],
}
