/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // HarvQ visual identity, ported from the CROPSYNC design
        // reference. paper is the airy page-level background; surface is
        // the white card/component background sitting on top of it.
        paper: '#F5FBFC',
        surface: '#FFFFFF',
        ink: '#164B5C',
        muted: '#58747D',
        primary: {
          DEFAULT: '#08745B',
          dark: '#00654D',
          light: '#E3F6E4',
        },
        accent: {
          DEFAULT: '#D9A441',
          dark: '#9A6B18',
          light: '#FDF3DF',
        },
        border: '#CDE5DF',
        danger: '#A23B2C',
        success: '#17604D',
      },
      fontFamily: {
        // Noto Sans first for Latin text; the Indic Noto families cover
        // Tamil/Devanagari/Telugu glyphs Noto Sans itself doesn't include.
        // Per Government of India DBIM typography standard.
        sans: [
          '"Noto Sans"',
          '"Noto Sans Tamil"',
          '"Noto Sans Devanagari"',
          '"Noto Sans Telugu"',
          'sans-serif',
        ],
      },
      borderRadius: {
        sm: '5px',
        DEFAULT: '9px',
        lg: '14px',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out both',
        'slide-up': 'slideUp 0.3s ease-out both',
        'pop-in': 'popIn 0.2s ease-out both',
        shake: 'shake 0.4s ease-in-out both',
      },
    },
  },
  plugins: [],
};
