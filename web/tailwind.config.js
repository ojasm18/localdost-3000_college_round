/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0E14',
        'surface-1': '#10151D',
        'surface-2': '#161C26',
        'surface-3': '#1D2531',
        border: '#232C3A',
        'border-strong': '#2F3B4D',
        text: '#E6EDF5',
        'text-muted': '#9AA7B8',
        'text-faint': '#6B7788',
        accent: '#2DD4A8',
        'accent-hover': '#4BE3BB',
        'accent-fg': '#04130E',
        info: '#5AA9FF',
        warning: '#F5B84B',
        danger: '#FF6B6B',
        violet: '#A78BFA',
        neutral: '#8896A9',
        'accent-soft': 'rgba(45,212,168,.12)',
        'info-soft': 'rgba(90,169,255,.12)',
        'warning-soft': 'rgba(245,184,75,.12)',
        'danger-soft': 'rgba(255,107,107,.12)',
        'violet-soft': 'rgba(167,139,250,.12)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        base: '14px',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
