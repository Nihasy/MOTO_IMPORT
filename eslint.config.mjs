import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Règles de Next (Core Web Vitals + TypeScript), celles que `next build`
// applique aussi. Les scripts et les sorties de build n'en relèvent pas.
const config = [
  {
    ignores: [".claude/**", ".next*/**", "node_modules/**", "data/**", "public/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `_nom` dit « reçu mais volontairement ignoré » : un paramètre imposé
      // par une signature (action de formulaire), ou un champ retiré d'un
      // objet par déstructuration (`sansChampsInternes`).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
];

export default config;
