/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf4ff",
          100: "#fae8ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#0F62FE",
          700: "#7e22ce",
          900: "#3b0764",
        },
        zinc: {
          450: "#8c8c9e",
          550: "#6b6b7b",
          650: "#52525e",
          750: "#3f3f46",
          850: "#2a2a2f",
        },
        gray: {
          850: "#1a1a1e",
          950: "#0a0a0c",
        },
        emerald: {
          450: "#34d496",
          650: "#059669",
        },
        purple: {
          450: "#b57bee",
          650: "#7c3aed",
        },
        amber: {
          450: "#fbbf24",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Outfit", "system-ui", "sans-serif"],
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "pulse-once": "pulseOnce 0.6s ease-out",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseOnce: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};
