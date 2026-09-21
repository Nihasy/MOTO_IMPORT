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
      // Attente du site : trois lignes de vitesse doublent une moto lancée.
      // Les lignes partent derrière le bord gauche et sortent à droite ; le
      // décalage entre elles est porté par `animationDelay` cote composant.
      // Le soubresaut est volontairement minuscule : au-dela de deux pixels,
      // la moto ne roule plus, elle tressaute.
      keyframes: {
        filante: {
          "0%": { transform: "translateX(-40px)", opacity: "0" },
          "15%": { opacity: "1" },
          "75%": { opacity: "1" },
          "100%": { transform: "translateX(248px)", opacity: "0" },
        },
        soubresaut: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-1.5px)" },
        },
        // La barre de navigation avance vite puis freine, et s'arrete a 92% :
        // la duree reelle est inconnue, une barre qui touche le bord puis
        // attend ment au visiteur.
        progression: {
          "0%": { transform: "scaleX(0.02)" },
          "35%": { transform: "scaleX(0.55)" },
          "70%": { transform: "scaleX(0.8)" },
          "100%": { transform: "scaleX(0.92)" },
        },
      },
      animation: {
        filante: "filante 1.15s linear infinite",
        soubresaut: "soubresaut 420ms ease-in-out infinite",
        progression: "progression 8s cubic-bezier(0.1, 0.8, 0.2, 1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
