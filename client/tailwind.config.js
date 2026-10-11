/** @type {import('tailwindcss').Config} */
// four colors, nothing else exists. a class with any other color simply produces no css.
const palette = {
  ink: '#111110',
  paper: '#F4F1EC',
  bone: '#E7E1D6',
  vermilion: '#E24B26',
};

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    colors: { transparent: 'transparent', current: 'currentColor', ...palette },
    borderColor: ({ theme }) => ({ ...theme('colors'), DEFAULT: palette.ink }),
    fontSize: {
      12: ['12px', '1.5'],
      14: ['14px', '1.55'],
      16: ['16px', '1.6'],
      20: ['20px', '1.45'],
      28: ['28px', '1.2'],
      40: ['40px', '1.05'],
      64: ['64px', '0.95'],
      96: ['96px', '0.92'],
      140: ['140px', '0.9'],
    },
    fontFamily: {
      display: ['"Instrument Serif"', '"Times New Roman"', 'serif'],
      sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
    },
    extend: {},
  },
  plugins: [],
};
