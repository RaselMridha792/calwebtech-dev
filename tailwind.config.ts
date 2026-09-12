import type { Config } from 'tailwindcss';

/**
 * Calwebtech design tokens. These match the approved mockups in /reference exactly.
 * Never introduce a raw hex value in a component; add a token here instead.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './content/**/*.{md,mdx}'],
  theme: {
    extend: {
      colors: {
        ink:      '#0A1D37',
        ink2:     '#12294A',
        primary:  '#1550E0',
        primaryd: '#0F3FB4',
        // Reserved for outcome metrics. Do not use decoratively.
        result:   '#0E9F87',
        mist:     '#EEF3F9',
        mist2:    '#F7FAFD',
        line:     '#DCE4EE',
        body:     '#41536B',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        shell: '1440px',
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        card:  '0 24px 50px -30px rgba(10,29,55,.45)',
        lift:  '0 40px 90px -30px rgba(0,0,0,.8)',
        cta:   '0 18px 40px -14px rgba(21,80,224,.8)',
      },
      backgroundImage: {
        'glow-blue': 'radial-gradient(58% 62% at 78% 18%, rgba(37,99,235,.55), transparent 68%)',
        'glow-teal': 'radial-gradient(50% 60% at 12% 88%, rgba(14,159,135,.30), transparent 70%)',
      },
      transitionDuration: {
        micro: '180ms',
      },
    },
  },
  plugins: [],
};

export default config;
