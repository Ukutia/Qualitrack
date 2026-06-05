/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Petróleo institucional — el acento de marca (no el azul Tailwind genérico).
        brand: {
          50: '#eef3f4',
          100: '#d4e3e5',
          200: '#a9c6cb',
          300: '#74a3aa',
          400: '#458089',
          500: '#2c6670',
          600: '#1f4e57',
          700: '#193f47',
          800: '#163339',
          900: '#0e2227',
        },
        // Dorado de "acreditación" — usado con moderación (hairlines, marca).
        gold: {
          200: '#ecdcb6',
          300: '#dcc08a',
          400: '#c9a368',
          500: '#b78c4a',
          600: '#9a733a',
        },
        // Tinta cálida para sidebar/encabezados.
        ink: {
          900: '#15161c',
          800: '#1c1e26',
          700: '#262a34',
          600: '#343a46',
        },
        paper: '#f4f1ea',
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
    },
  },
  plugins: [],
};
