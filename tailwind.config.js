/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark-rgb) / <alpha-value>)',
        },
        bg: '#0e0e12',
        panel: '#17171c',
        gray: {
          50: '#f7f7f7',
          100: '#f2f2f2',
          200: '#e6e6e6',
          300: '#cccccc',
          400: '#a6a6a6',
          500: '#808080',
          600: '#666666',
          700: '#4d4d4d',
          800: '#333333',
          900: '#1a1a1a',
          950: '#0d0d0d',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
