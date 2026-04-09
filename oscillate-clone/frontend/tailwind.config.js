/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["'Silkscreen'", "monospace"],
        display: ["'Anton'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        sg: ["'Space Grotesk'", "sans-serif"],
        inter: ["'Inter'", "sans-serif"],
      },
      borderRadius: {
        lg: '0px',
        md: '0px',
        sm: '0px',
      },
      colors: {
        background: '#0A0A0A',
        foreground: '#FFFFFF',
        card: {
          DEFAULT: '#121212',
          foreground: '#FFFFFF'
        },
        popover: {
          DEFAULT: '#121212',
          foreground: '#FFFFFF'
        },
        primary: {
          DEFAULT: '#FF3B00',
          foreground: '#000000'
        },
        secondary: {
          DEFAULT: '#27272A',
          foreground: '#FFFFFF'
        },
        muted: {
          DEFAULT: '#121212',
          foreground: '#A1A1AA'
        },
        accent: {
          DEFAULT: '#FF3B00',
          foreground: '#000000'
        },
        destructive: {
          DEFAULT: '#FF0000',
          foreground: '#FFFFFF'
        },
        border: '#27272A',
        input: '#27272A',
        ring: '#FF3B00',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
