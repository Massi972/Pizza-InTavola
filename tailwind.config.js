/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        ios: {
          blue: '#007AFF',
          red: '#FF3B30',
          green: '#34C759',
          orange: '#FF9500',
          gray: '#8E8E93',
          lightGray: '#E5E5EA',
          bg: '#F2F2F7'
        }
      }
    },
  },
  plugins: [],
}