/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Overflatenivåer som ikke daisyUI sin base-100/200/300-skala dekker.
        // Matcher den fem-trinns lysstyrke-rampen som allerede finnes i praksis
        // (hardkodet som hex rundt om i komponentene) - se design-evaluering.
        "surface-raised": "#171a25", // modal-bokser, kort-/panel-headere
        "surface-field": "#262b3a",  // input/select/kort - mest "hevet" flate
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        klasseplass: {
          "primary": "#34d399",
          "primary-content": "#04150a",
          "secondary": "#4f46e5",
          "secondary-content": "#ffffff",
          "accent": "#f59e0b",
          "accent-content": "#1a1206",
          "neutral": "#1e293b",
          "neutral-content": "#e2e8f0",
          "base-100": "#202534",
          "base-200": "#1a1e2b",
          "base-300": "#12151e",
          "base-content": "#e2e8f0",
          "info": "#38bdf8",
          "info-content": "#031b26",
          "success": "#22c55e",
          "success-content": "#04150a",
          "warning": "#f59e0b",
          "warning-content": "#1a1206",
          "error": "#ef4444",
          "error-content": "#ffffff",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.5rem",
          "--rounded-badge": "9999px",
        },
      },
    ],
  },
}
