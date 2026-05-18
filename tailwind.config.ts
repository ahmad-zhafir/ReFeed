import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ReFeed editorial palette — backed by CSS variables in app/globals.css.
      // Use as: bg-rf-card, text-rf-bone, border-rf-moss, text-rf-amber, etc.
      colors: {
        rf: {
          forest:      'var(--rf-forest)',
          moss:        'var(--rf-moss)',
          card:        'var(--rf-card)',
          ink:         'var(--rf-ink)',
          bone:        'var(--rf-bone)',
          cream:       'var(--rf-cream)',
          'bone-muted': 'var(--rf-bone-muted)',
          'bone-dim':   'var(--rf-bone-dim)',
          sap:         'var(--rf-sap)',
          'sap-deep':   'var(--rf-sap-deep)',
          'sap-bright': 'var(--rf-sap-bright)',
          rust:        'var(--rf-rust)',
          amber:       'var(--rf-amber)',
          sky:         'var(--rf-sky)',
        },
      },
      fontFamily: {
        fraunces:   ['Fraunces', 'Times New Roman', 'serif'],
        instrument: ['Instrument Serif', 'Times New Roman', 'serif'],
        'mono-jb':  ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
