import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0E1215",
        surface: "#171C21",
        "surface-hi": "#1F262D",
        line: "#2B333B",
        gold: "#C08A2E",
        "gold-light": "#E7C983",
        chrome: "#B9C2CB",
        text: "#F2F5F7",
        dim: "#8A939C",
        dispo: "#45A55A",
        immediat: "#E5342A",
        reserve: "#4E86D6",
        vendu: "#B8433C",
        "on-gold": "#12160F",
      },
      fontFamily: {
        sans: ["var(--font-open-sans)", "system-ui", "sans-serif"],
      },
      // Echelle typographique reprise de motoconcess.com : h1 fiche 28/32 (24/28
      // sous 600px), titre de vignette 20/24, texte courant 15/18, prix 18/18.
      fontSize: {
        "prix-fiche": ["28px", { lineHeight: "32px", fontWeight: "800" }],
        "prix-carte": ["18px", { lineHeight: "18px", fontWeight: "700" }],
        "titre-fiche": ["24px", { lineHeight: "28px", fontWeight: "700" }],
        "titre-carte": ["20px", { lineHeight: "24px", fontWeight: "700" }],
        corps: ["15px", { lineHeight: "22px" }],
        meta: ["14px", { lineHeight: "18px" }],
        badge: ["12px", { lineHeight: "16px", fontWeight: "600" }],
      },
      // Vignettes et cadres photo restent a angle vif ; seuls les controles
      // gardent le rayon de 5px du site de reference.
      borderRadius: { card: "5px", sheet: "5px" },
      spacing: { touch: "44px" },
    },
  },
  plugins: [],
};
export default config;
