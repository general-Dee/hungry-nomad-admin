import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        text: "var(--color-text)",
        divider: "var(--color-divider)",
        accent: {
          DEFAULT: "var(--color-accent)",
          100: "var(--color-accent-100)",
          200: "var(--color-accent-200)",
          300: "var(--color-accent-300)",
          400: "var(--color-accent-400)",
          500: "var(--color-accent-500)",
          600: "var(--color-accent-600)",
          700: "var(--color-accent-700)",
          800: "var(--color-accent-800)",
          900: "var(--color-accent-900)",
        },
        "accent-2": {
          DEFAULT: "var(--color-accent-2)",
          100: "var(--color-accent-2-100)",
          200: "var(--color-accent-2-200)",
          300: "var(--color-accent-2-300)",
          400: "var(--color-accent-2-400)",
          500: "var(--color-accent-2-500)",
          600: "var(--color-accent-2-600)",
          700: "var(--color-accent-2-700)",
          800: "var(--color-accent-2-800)",
          900: "var(--color-accent-2-900)",
        },
        neutral: {
          100: "var(--color-neutral-100)",
          200: "var(--color-neutral-200)",
          300: "var(--color-neutral-300)",
          400: "var(--color-neutral-400)",
          500: "var(--color-neutral-500)",
          600: "var(--color-neutral-600)",
          700: "var(--color-neutral-700)",
          800: "var(--color-neutral-800)",
          900: "var(--color-neutral-900)",
        },
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
        heading: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
