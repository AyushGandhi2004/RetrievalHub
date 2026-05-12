/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {

      // ── BRAND IDENTITY: Warm coral / terracotta ─────────────────────────────
      colors: {
        coral: {
          50:  '#FFF4F0',
          100: '#FFE4D9',
          200: '#FFCAB4',
          300: '#FF9F7A',
          400: '#F57C5A',
          500: '#E8623E',
          600: '#C94A28',
        },

        stone: {
          50:  '#FAFAFA',
          100: '#F5F4F2',
          200: '#EEECE9',
          300: '#E0DDD8',
          400: '#C5C1BA',
          500: '#9A9590',
          600: '#6B6762',
          700: '#4A4744',
          800: '#2E2C2A',
          900: '#1A1917',
        },

        rag: {
          DEFAULT: '#4F6DF5',
          light:   '#EEF1FE',
          border:  '#C5CEFB',
        },
        vectorless: {
          DEFAULT: '#2DAF7F',
          light:   '#E8F8F3',
          border:  '#A3E2CC',
        },

        success: '#2D9E6B',
        warning: '#D97706',
        error:   '#DC2626',
        info:    '#2563EB',
      },

      // ── TYPOGRAPHY ───────────────────────────────────────────────────────────
      fontFamily: {
        display: ['"DM Serif Display"', 'serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },

      // ── LAYOUT ───────────────────────────────────────────────────────────────
      maxWidth: {
        content: '1280px',
        chat:    '820px',
      },
      width: {
        sidebar: '320px',
      },

      // ── SHADOWS ──────────────────────────────────────────────────────────────
      boxShadow: {
        card:   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        lifted: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        coral:  '0 4px 14px rgba(245,124,90,0.30)',
      },

      // ── BORDER RADIUS ────────────────────────────────────────────────────────
      borderRadius: {
        DEFAULT: '8px',
        lg:      '14px',
        xl:      '20px',
      },

      // ── ANIMATIONS ───────────────────────────────────────────────────────────
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.35' },
        },
      },
      animation: {
        'fade-up':   'fade-up 0.3s ease-out',
        'pulse-dot': 'pulse-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
