import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cf-bg': '#0a0a0f',
        'cf-surface': '#13131a',
        'cf-surface-elevated': '#1a1a24',
        'cf-border': '#2a2a3a',
        'cf-primary': '#6366f1',
        'cf-primary-glow': '#818cf8',
        'cf-accent': '#22d3ee',
        'cf-success': '#10b981',
        'cf-warning': '#f59e0b',
        'cf-error': '#ef4444',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'ghost-pulse': 'ghost-pulse 3s ease-in-out infinite',
        'flow-gradient': 'flow-gradient 2s linear infinite',
        'node-select': 'node-select 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(99, 102, 241, 0.5), 0 0 10px rgba(99, 102, 241, 0.3)',
          },
          '50%': {
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.8), 0 0 25px rgba(99, 102, 241, 0.5)',
          },
        },
        'ghost-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        'flow-gradient': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'node-select': {
          '0%': { transform: 'scale(0.95)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;