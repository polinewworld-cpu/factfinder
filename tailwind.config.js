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
      fontWeight: {
        medium: '400',
        extrabold: '700',
      },
      fontSize: {
        lg: ['16px', { lineHeight: '1.4' }],
        '2xl': ['20px', { lineHeight: '1.3' }],
        '5xl': ['26px', { lineHeight: '1.15' }],
      },
      borderRadius: {
        md: 'var(--radius)',
        lg: 'var(--radius)',
        xl: 'var(--radius)',
        '2xl': 'var(--radius)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
