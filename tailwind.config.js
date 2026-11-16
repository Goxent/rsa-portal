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
        sans: ['Instrument Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        heading: ['Instrument Sans', 'system-ui', 'sans-serif'],
        display: ['Newsreader', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Carbon Ledger — dark surfaces
        carbon: {
          950: '#0c0f0e',
          900: '#131816',
          800: '#1a201d',
          700: '#222925',
          600: '#2b332e',
        },
        // Olive-green accent
        brand: {
          50:  '#eef6f1',
          100: '#d5e8dc',
          200: '#aed2bd',
          300: '#82b999',
          400: '#4fb286',
          500: '#3a8f68',
          600: '#2a6a4b',
          700: '#1f5239',
          800: '#173d2b',
          900: '#0f2a1d',
          950: '#081a11',
        },
        // Parchment — light mode surfaces
        parchment: {
          50:  '#fafbf9',
          100: '#f5f6f4',
          200: '#eef0ed',
          300: '#e4e7e2',
          400: '#cfd4cd',
          500: '#aab1a8',
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
          green:   '#4fb286',
          amber:   '#c98a2a',
          rose:    '#e0707a',
          sky:     '#6aa3d9',
          neutral: '#6a6866',
        },
        navy: {
          900: '#0a0b0d',
          950: '#060709',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.35s ease-out forwards',
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
          '0%': { opacity: '0', transform: 'translateY(8px)' },
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
