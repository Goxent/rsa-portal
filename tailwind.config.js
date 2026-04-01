/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
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
          950: '#0c0c0e',
          900: '#141416',
          800: '#1c1c1f',
          700: '#242427',
          600: '#2e2e32',
        },
        // Forest green accent (Carbon Ledger & Parchment Office)
        brand: {
          50:  '#f0faf5',
          100: '#d6f2e5',
          200: '#aee4cb',
          300: '#7dcfaf',
          400: '#4db090',
          500: '#2e8a61', // Dark mode accent
          600: '#237050',
          700: '#1a6e4d', // Light mode accent
          800: '#155c3f',
          900: '#0f4530',
          950: '#082a1d',
        },
        // Parchment — light mode surfaces
        parchment: {
          50:  '#fdfcf9',
          100: '#f7f5f0',
          200: '#f0ede6',
          300: '#e6e2d8',
          400: '#d4cfc2',
          500: '#b8b3a6',
        },
        base: '#0c0c0e',
        surface: '#141416',
        card: '#1c1c1f',
        accent: {
          green:  '#2e8a61',
          amber:  '#d4903a',
          rose:   '#c94f5e',
          sky:    '#4f8ed4',
          neutral: '#6b6966',
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
