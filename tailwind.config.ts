import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0E6E55",
          dark: "#0A5443",
          light: "#E6F3EF",
        },
        ink: {
          DEFAULT: "#1F2937",
          muted: "#64748B",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          page: "#F7F8FA",
        },
        border: {
          DEFAULT: "#E2E8F0",
        },
        success: {
          DEFAULT: "#15803D",
          light: "#DCFCE7",
        },
        warning: {
          DEFAULT: "#B45309",
          light: "#FEF3C7",
        },
        danger: {
          DEFAULT: "#DC2626",
          light: "#FEE2E2",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
