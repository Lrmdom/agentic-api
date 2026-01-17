/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        honda: {
          red: '#E60012',
          dark: '#1A1A1A',
          gray: '#6B7280',
          light: '#F3F4F6',
        }
      }
    },
  },
  plugins: [],
}
