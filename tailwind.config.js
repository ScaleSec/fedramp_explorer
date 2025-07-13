/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './layouts/**/*.html',
    './assets/js/**/*.js',
    './content/**/*.md',
  ],
  theme: {
    extend: {
      colors: {
        'brand-green': '#82CC26',
        'brand-gray-dark': '#4D4D4D',
        'brand-gray-light': '#F4F4F4',
        'brand-blue': '#004df2',
        'brand-silver': '#DBDBDB',
      },
      fontFamily: {
        'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
