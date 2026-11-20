/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // BookMyUtsav navy (logo #002453) and orange (logo #FF761E)
        brand: {
          50: '#eef3fb', 100: '#dbe5f6', 200: '#b7caec', 300: '#86a5db', 400: '#5278c2', 500: '#2f58a6',
          600: '#1e4388', 700: '#143670', 800: '#0b2c61', 900: '#002453', 950: '#00163a',
        },
        gold: { 50: '#fff4ec', 100: '#ffe4cf', 200: '#ffc79f', 300: '#ffa466', 400: '#ff8a3d', 500: '#ff761e', 600: '#e65f0a', 700: '#b54708' },
        ink: { 50: '#f7f7f8', 100: '#eeeef1', 200: '#d9d9e0', 300: '#b8b8c5', 400: '#9191a3', 500: '#737388', 600: '#5d5d70', 700: '#4c4c5b', 800: '#41414d', 900: '#2a2a33', 950: '#18181d' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(24,24,29,.04), 0 4px 16px rgba(24,24,29,.06)',
        lift: '0 8px 30px rgba(0,36,83,.14)',
      },
    },
  },
  plugins: [],
};
