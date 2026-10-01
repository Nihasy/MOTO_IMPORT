import type { Reglages } from "@/lib/tarification";

/**
 * Réglages de départ — INFORMATION INTERNE. À n'importer que depuis du code
 * serveur (`tarification-serveur.ts`, route d'import, tests) : un composant
 * client qui l'importerait livrerait ces chiffres au navigateur.
 */
export const REGLAGES_DEFAUT: Reglages = {
  taux_yuan: 670,
  taux_usd: 4_650,
  fret_usd_m3: 360,
  // Médianes du relevé « Cubage motos en caisse » (89 modèles, moto démontée,
  // roues et fourche dans la caisse, calibré sur une caisse mesurée). Les
  // gabarits hors norme — boxer BMW, gros custom, grand tourisme — portent
  // leur volume sur la fiche. Le relevé ne couvre ni les cross ni les
  // scooters : ces deux valeurs sont des estimations, à corriger à la
  // première caisse mesurée.
  volumes_m3: {
    roadster: 1.1,
    sportive: 1.08,
    routiere: 1.2,
    trail: 1.25,
    custom: 1.1,
    motocross: 0.65,
    scooter: 1.6,
  },
  dossier_ar: 1_500_000,
  dossier_gros_ar: 2_000_000,
  seuil_gros_cc: 950,
  caisse_yuan: 300,
  benefice_fixe_ar: 2_000_000,
  part_achat_pct: 10,
  securite_change_pct: 3,
  arrondi_ar: 50_000,
};

/**
 * Réglages enregistrés, complétés par les valeurs de départ. Ceux d'avant le
 * fret au volume ne portent ni dollar ni volumes : sans ce complément, le
 * calcul produirait des prix sans fret.
 */
export const completerReglages = (stockes: Partial<Reglages>): Reglages => ({
  ...REGLAGES_DEFAUT,
  ...stockes,
  volumes_m3: { ...REGLAGES_DEFAUT.volumes_m3, ...stockes.volumes_m3 },
});
