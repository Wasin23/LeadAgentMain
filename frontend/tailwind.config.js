/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable dark mode with class strategy
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        loading: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        progress: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        }
      },
      animation: {
        loading: 'loading 1.5s ease-in-out infinite',
        progress: 'progress 2s ease-out forwards',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}