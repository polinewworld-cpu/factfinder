/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#ec1561', // 로고/포인트 핑크
          dark: '#c01050',
        },
        bg: '#0e0e12',
        panel: '#17171c',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
