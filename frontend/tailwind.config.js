/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blood: {
          50: '#FFF7F7',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#EF4444', // Primary coral-red
          700: '#DC2626',
          800: '#B91C1C',
          900: '#991B1B',
        },
        lifelink: {
          DEFAULT: '#E81743',
          50: '#FFF1F4',
          100: '#FFE4E8',
          200: '#FECDD6',
          300: '#FDA4B6',
          400: '#FB718F',
          500: '#F43F68',
          600: '#E81743', // LifeLink crimson primary
          700: '#BF0F36',
          800: '#9E102E',
          900: '#84122C',
        },
        coral: {
          50: '#FFF7F7',
          100: '#FFEBEA',
          200: '#FFD4D0',
          300: '#FFAAA1',
          400: '#FF7B6E',
          500: '#F97316',
          600: '#EF4444',
          700: '#DC2626',
        },
        healthcare: {
          dark: '#111827',
          card: '#FFFFFF',
          accent: '#EF4444',
          light: '#FFF7F7'
        }
      }
    },
  },
  plugins: [],
}

