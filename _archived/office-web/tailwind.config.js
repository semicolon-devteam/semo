/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'office-bg': '#1a1a2e',
        'office-floor': '#16213e',
        'office-wall': '#0f3460',
        'agent-fe': '#e94560',
        'agent-be': '#0f4c75',
        'agent-qa': '#3fc1c9',
        'agent-po': '#fc5185',
        'agent-devops': '#364f6b',
      },
    },
  },
  plugins: [],
};
