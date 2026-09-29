/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
  50: '#EEF7FF',
  100: '#D8F1FF',
  400: '#66D9F5',
  500: '#33C8F2',
  600: '#18B8E8',
  700: '#070F4F',
  800: '#050B3A',
  900: '#030626',
},
       brand: {
  50: '#EEF7FF',
  100: '#D8F1FF',
  500: '#66D9F5',
  600: '#33C8F2',
  700: '#070F4F',
},
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
