import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary accent - electric cyan, used wherever `brand` was used before.
        brand: {
          DEFAULT: "#22D3EE",
          dark: "#0EA5C9",
          light: "rgba(34, 211, 238, 0.14)",
        },
        // Secondary nebula accent.
        violet: {
          DEFAULT: "#8B5CF6",
          dark: "#6D28D9",
          light: "rgba(139, 92, 246, 0.14)",
        },
        // Restrained tertiary accent - decorative only (nebula gradients, celebration bursts), never a primary UI color.
        magenta: {
          DEFAULT: "#E879F9",
          light: "rgba(232, 121, 249, 0.12)",
        },
        // Warm highlight - decorative (star glints, achievement shine), distinct from the `warning` semantic.
        gold: {
          DEFAULT: "#F5C84C",
          dim: "#B9862A",
          light: "rgba(245, 200, 76, 0.14)",
        },
        cosmic: {
          void: "#05060B",
          deep: "#0A0E1F",
          nebula: "#131A33",
        },
        ink: {
          DEFAULT: "#E6EDF7",
          muted: "#8FA0C2",
          faint: "#5B6B8C",
        },
        surface: {
          DEFAULT: "rgba(18, 24, 46, 0.6)",
          raised: "rgba(26, 33, 61, 0.72)",
          page: "#05060B",
        },
        border: {
          DEFAULT: "rgba(148, 174, 214, 0.16)",
          glow: "rgba(34, 211, 238, 0.4)",
        },
        success: {
          DEFAULT: "#34D399",
          light: "rgba(52, 211, 153, 0.14)",
        },
        warning: {
          DEFAULT: "#FBBF24",
          light: "rgba(251, 191, 36, 0.14)",
        },
        danger: {
          DEFAULT: "#FB7185",
          light: "rgba(251, 113, 133, 0.14)",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34, 211, 238, 0.25), 0 0 24px -4px rgba(34, 211, 238, 0.35)",
        "glow-violet": "0 0 0 1px rgba(139, 92, 246, 0.25), 0 0 24px -4px rgba(139, 92, 246, 0.35)",
        "glow-gold": "0 0 0 1px rgba(245, 200, 76, 0.25), 0 0 24px -4px rgba(245, 200, 76, 0.35)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 30px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        "nebula-drift": {
          "0%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-1.5%,1%,0) scale(1.04)" },
          "100%": { transform: "translate3d(0,0,0) scale(1)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 211, 238, 0.35)" },
          "50%": { boxShadow: "0 0 0 8px rgba(34, 211, 238, 0)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          /* "none", not "translateY(0)" - any non-"none" transform value (even a zero one) makes
             the element a containing block for `position: fixed` descendants once the animation's
             `fill-mode: both` holds this end state, which would break a fixed-position overlay
             (e.g. AchievementCelebration) nested inside an animated element. */
          "100%": { opacity: "1", transform: "none" },
        },
        "burst-in": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "beam-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        twinkle: "twinkle 3.2s ease-in-out infinite",
        "nebula-drift": "nebula-drift 40s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        orbit: "orbit 60s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
        "burst-in": "burst-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "beam-pulse": "beam-pulse 10s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
