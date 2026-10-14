import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF9F4",
        blush: "#FBE4EC",
        pink: {
          DEFAULT: "#F3A7C5",
          dark: "#D97BA3",
        },
        lavender: {
          DEFAULT: "#CDBFEF",
          dark: "#A693D6",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
