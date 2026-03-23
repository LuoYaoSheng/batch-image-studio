/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#00488d",
        "primary-strong": "#005fb8",
        surface: "#f7f9fc",
        "surface-low": "#f2f4f7",
        "surface-panel": "#ffffff",
        "surface-rail": "#e6e8eb",
        ink: "#191c1e",
        muted: "#5c6470",
        line: "#d9dee8",
        success: "#147d57",
        warning: "#b56a00",
      },
      boxShadow: {
        ambient: "0 18px 40px rgba(0, 72, 141, 0.08)",
      },
      borderRadius: {
        panel: "16px",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
