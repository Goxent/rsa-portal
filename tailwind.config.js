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
          900: '#0a0e1a',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155',
        },
        dark: {
          900: '#0a0e1a',
          800: '#0f172a',
          700: '#1e293b',
        },
        brand: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcd0e8',
          300: '#9db8d9',
          400: '#6b9bd1',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#102a43',
          900: '#0a1c2d',
        },
        accent: {
          cyan: '#06b6d4',
          purple: '#8b5cf6',
          pink: '#ec4899',
          gold: '#f59e0b',
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
