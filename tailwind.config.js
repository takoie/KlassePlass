// Lys base delt av alle fire lyse temaer. Aksent-/status-fargene settes per tema.
const LIGHT_BASE = {
  "neutral": "#e6eaf0",
  "neutral-content": "#1c2431",
  "base-100": "#ffffff",
  "base-200": "#f4f6f9",
  "base-300": "#e6eaf0",
  "base-content": "#1c2431",
  "--rounded-box": "1rem",
  "--rounded-btn": "0.5rem",
  "--rounded-badge": "9999px",
};

// Lyse varianter av de fire fargetemaene. colorMode='light' i App.jsx legger
// "-light" på det valgte fargetemaet. Aksentene er justert for kontrast mot hvitt.
function lightVariants() {
  const accents = {
    klasseplass: { primary: "#059669", "primary-content": "#ffffff", secondary: "#4f46e5", "secondary-content": "#ffffff", accent: "#d97706", "accent-content": "#ffffff" },
    havbris:     { primary: "#0284c7", "primary-content": "#ffffff", secondary: "#4f46e5", "secondary-content": "#ffffff", accent: "#d97706", "accent-content": "#ffffff" },
    solnedgang:  { primary: "#ea580c", "primary-content": "#ffffff", secondary: "#e11d48", "secondary-content": "#ffffff", accent: "#0284c7", "accent-content": "#ffffff" },
    lavendel:    { primary: "#7c3aed", "primary-content": "#ffffff", secondary: "#0891b2", "secondary-content": "#ffffff", accent: "#d97706", "accent-content": "#ffffff" },
  };
  const status = {
    "info": "#0284c7", "info-content": "#ffffff",
    "success": "#16a34a", "success-content": "#ffffff",
    "warning": "#d97706", "warning-content": "#ffffff",
    "error": "#dc2626", "error-content": "#ffffff",
  };
  return Object.entries(accents).map(([name, acc]) => ({
    [`${name}-light`]: { ...LIGHT_BASE, ...acc, ...status },
  }));
}

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
        // Nå tema-styrt via CSS-variabler (se src/index.css) slik at de bytter
        // med lys/mørk modus. Verdiene er "R G B" (space-separert) for <alpha-value>.
        "surface-raised": "rgb(var(--kp-surface-raised) / <alpha-value>)", // modal-bokser, kort-/panel-headere
        "surface-field": "rgb(var(--kp-surface-field) / <alpha-value>)",  // input/select/kort - mest "hevet" flate
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        // Standard - emerald/indigo/amber på mørk marineblå.
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
      {
        // Havbris - rolig himmelblå/indigo, samme mørke base.
        havbris: {
          "primary": "#38bdf8",
          "primary-content": "#04212f",
          "secondary": "#6366f1",
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
      {
        // Solnedgang - varm oransje/korall, samme mørke base.
        solnedgang: {
          "primary": "#fb923c",
          "primary-content": "#2a1002",
          "secondary": "#f43f5e",
          "secondary-content": "#ffffff",
          "accent": "#38bdf8",
          "accent-content": "#04212f",
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
      {
        // Lavendel - kreativ fiolett/cyan, samme mørke base.
        lavendel: {
          "primary": "#a78bfa",
          "primary-content": "#1e1b3a",
          "secondary": "#06b6d4",
          "secondary-content": "#022c33",
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

      // --- Lyse varianter -------------------------------------------------
      ...lightVariants(),
    ],
  },
}
