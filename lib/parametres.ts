import { cache } from "react";
import { db } from "@/lib/db";
import type { LigneHoraire, Parametres } from "@/lib/types";

/**
 * Valeurs en vigueur tant que rien n'a été enregistré depuis le back-office :
 * celles que le site affichait jusqu'ici, numéro WhatsApp de l'environnement
 * compris.
 */
const WHATSAPP_ENV =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") || "261340000000";

export const HORAIRES_DEFAUT: LigneHoraire[] = [
  { jours: "Lundi – vendredi", heures: "8 h 30 – 17 h 30" },
  { jours: "Samedi", heures: "9 h – 13 h" },
  { jours: "Dimanche", heures: "Fermé" },
];

export const PARAMETRES_DEFAUT: Parametres = {
  adresse: process.env.NEXT_PUBLIC_ADRESSE ?? "Lot II M 85 Bis, Analamahitsy, Antananarivo 101",
  horaires: HORAIRES_DEFAUT,
  whatsapp: WHATSAPP_ENV,
  telephone: `+${WHATSAPP_ENV}`,
};

/**
 * Paramètres du site, lus une fois par rendu (`cache`). Une base injoignable
 * ou une table pas encore créée ne doit pas faire tomber les pages publiques :
 * on retombe alors sur les valeurs par défaut.
 */
export const parametres = cache(async (): Promise<Parametres> => {
  try {
    const p = await db().lireParametres();
    if (!p) return PARAMETRES_DEFAUT;
    return {
      adresse: p.adresse?.trim() || PARAMETRES_DEFAUT.adresse,
      horaires: Array.isArray(p.horaires) ? p.horaires : PARAMETRES_DEFAUT.horaires,
      whatsapp: p.whatsapp?.replace(/[^\d]/g, "") || PARAMETRES_DEFAUT.whatsapp,
      telephone: p.telephone?.trim() || PARAMETRES_DEFAUT.telephone,
    };
  } catch (e) {
    console.error("[parametres] lecture impossible, valeurs par défaut :", (e as Error).message);
    return PARAMETRES_DEFAUT;
  }
});

/**
 * `tel:` au format international. Le numéro se saisit comme on l'écrit à Tana
 * (« 034 12 345 67 ») ou avec l'indicatif (« +261 34 … », « 00261 34 … »).
 */
export function lienTelephone(telephone: string): string {
  const brut = telephone.replace(/[^\d+]/g, "");
  if (brut.startsWith("+")) return `tel:${brut}`;
  if (brut.startsWith("00")) return `tel:+${brut.slice(2)}`;
  if (brut.startsWith("0")) return `tel:+261${brut.slice(1)}`;
  return `tel:+${brut}`;
}
