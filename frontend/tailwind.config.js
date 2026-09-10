/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FFFFFF',
        surface: '#FFFFFF',
        ink: '#1B2420',
        muted: '#6B7268',
        primary: {
          DEFAULT: '#23543A',
          dark: '#163826',
          light: '#DCE8DF',
        },
        accent: {
          DEFAULT: '#C9972B',
          dark: '#9C7420',
          light: '#F4E6C4',
        },
        border: '#DCD9CC',
        danger: '#A83232',
        success: '#2E7D4F',
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
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
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
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out both',
        'slide-up': 'slideUp 0.3s ease-out both',
        'pop-in': 'popIn 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
