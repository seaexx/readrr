/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#38B6FF',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      }
    },
  },
  plugins: [],
}

