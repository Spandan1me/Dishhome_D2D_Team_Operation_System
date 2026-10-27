/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-red': '#F44336',
        'brand-red-dark': '#E31E24',
        'brand-red-light': '#FDECEA',
        'page-bg': '#E9CFCF',
        'app-bg': '#FBF3F3',
        'surface': '#FFFFFF',
        'text-primary': '#212121',
        'text-secondary': '#5F6368',
        'input-bg': '#E8F0FE',
        'input-focus': '#2979FF',
        'link': '#00BCD4',
        'success': '#2E7D32',
        'warning': '#F9A825',
        'danger': '#C62828',
        'border': '#E0E0E0',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        login: '0 10px 40px -10px rgba(0, 0, 0, 0.12), 0 2px 10px -2px rgba(0, 0, 0, 0.06)',
      },
      borderRadius: {
        'card-lg': '24px',
        'card-md': '16px',
        'card-sm': '10px',
      }
    },
  },
  plugins: [],
}
