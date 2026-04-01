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
        sans: ['Inter', 'sans-serif'],
        heading: ['Montserrat', 'sans-serif'],
      },
      colors: {
        navy: {
          950: '#09090b',
          900: '#121214',
          800: '#1c1c1f',
          700: '#27272a',
          600: '#3f3f46',
        },
        brand: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#d9e2fd',
          300: '#b7cafb',
          400: '#8ba6f7',
          500: '#6382f1', // Main Royal Indigo
          600: '#4f66e5',
          700: '#4351ca',
          800: '#373ea3',
          900: '#313581',
          950: '#1e204b',
        },
        midnight: {
          950: '#0a0a0c',
          900: '#121214',
          800: '#1a1a1c',
        },
        base: '#0a0a0c',
        surface: '#121214',
        card: '#1a1a1c',
        accent: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
          pink: '#ec4899',
          gold: '#f59e0b',
          indigo: '#6366f1',
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
