import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}','./components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink:    '#1a1a2e',
        mist:   '#e8edf5',
        sky: { DEFAULT: '#2563a8', light: '#dbeafe' },
        heather:'#6b4f7a',
        gold:   { DEFAULT: '#c9963a', pale: '#fef3d0' },
        soft:   '#475569',
        line:   '#d1d9e6',
        'card-bg': '#f7f9fd',
        brand: {
          50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',
          500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a',
        },
      },
      fontFamily: {
        sans:  ['var(--font-source-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      borderRadius: { card: '14px' },
      boxShadow:    { card: '0 2px 16px rgba(26,26,46,0.10)' },
    },
  },
  plugins: [],
}
export default config
