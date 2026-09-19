import type { Reglages } from "@/lib/tarification";

/**
 * Réglages de départ — INFORMATION INTERNE. À n'importer que depuis du code
 * serveur (`tarification-serveur.ts`, route d'import, tests) : un composant
 * client qui l'importerait livrerait ces chiffres au navigateur.
 */
export const REGLAGES_DEFAUT: Reglages = {
  taux_yuan: 670,
  fret_ar: 5_000_000,
  benefice_fixe_ar: 2_000_000,
  part_achat_pct: 10,
  securite_change_pct: 3,
  arrondi_ar: 50_000,
};
