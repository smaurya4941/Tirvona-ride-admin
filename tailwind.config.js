/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bhagwa: {
          50: "#FFF9F2",
          100: "#FFF4E7",
          500: "#E67E22",
          600: "#C95E00",
        },
        midnight: "#0B192C",
        ivory: "#FFFDF8",
        sand: "#F7F3ED",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
