/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Azul institucional — el acento de marca, anclado en Alice Blue (D8EBFB).
        brand: {
          50: '#f5f9fe',
          100: '#e8f2fc',
          200: '#d8ebfb',
          300: '#b0d4f5',
          400: '#7fb6ea',
          500: '#4f96d9',
          600: '#3778bd',
          700: '#2c5f97',
          800: '#234a74',
          900: '#1a3752',
        },
        // Dorado "Sunlit Clay" — usado con moderación (hairlines, marca).
        gold: {
          200: '#f0dbb0',
          300: '#e5c58a',
          400: '#dab264',
          500: '#d3a04e',
          600: '#b3853d',
        },
        // Tinta "Carbon Black" para sidebar/encabezados.
        ink: {
          900: '#181b21',
          800: '#20242c',
          700: '#2a2f38',
          600: '#363c47',
        },
        // Gris neutro "Grey Olive" — texto secundario, bordes, estados deshabilitados.
        steel: {
          50: '#f7f7f7',
          100: '#eeeeee',
          200: '#dcdcdc',
          300: '#c4c4c4',
          400: '#adadad',
          500: '#959595',
          600: '#767676',
          700: '#5c5c5c',
          800: '#424242',
          900: '#2b2b2b',
        },
        paper: '#fff7eb',
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(22, 33, 37, 0.05), 0 10px 26px -14px rgba(22, 33, 37, 0.22)',
        lift: '0 2px 6px rgba(22, 33, 37, 0.07), 0 22px 48px -20px rgba(22, 33, 37, 0.34)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      borderRadius: {
        xl2: '1.15rem',
      },
      zIndex: {
        60: '60',
      },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'pulse-highlight': {
          '0%, 100%': { backgroundColor: 'rgba(44, 102, 112, 0.16)' },
          '50%': { backgroundColor: 'rgba(44, 102, 112, 0.04)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'pulse-highlight': 'pulse-highlight 1.4s ease-in-out 4',
      },
    },
  },
  plugins: [],
};
