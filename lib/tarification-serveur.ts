import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Moto, Statut } from "@/lib/types";
import { calculerPrix, erreurReglages, type Gabarit, type Reglages } from "@/lib/tarification";
import { REGLAGES_DEFAUT, completerReglages } from "@/lib/tarification-defaut";

/**
 * Réglages en vigueur, lus une fois par rendu. Table absente (migration 0009
 * pas encore appliquée) ou réglages jamais enregistrés : valeurs par défaut.
 * Des réglages stockés mais incohérents sont écartés au profit des défauts
 * plutôt que de produire des prix aberrants.
 */
export const reglagesEnVigueur = cache(async (): Promise<Reglages> => {
  try {
    const r = await db().lireTarification();
    if (!r) return REGLAGES_DEFAUT;
    const fusion = completerReglages(r);
    return erreurReglages(fusion) ? REGLAGES_DEFAUT : fusion;
  } catch (e) {
    console.error("[tarification] lecture impossible, réglages par défaut :", (e as Error).message);
    return REGLAGES_DEFAUT;
  }
});

/** Champs de prix à écrire sur une moto, calculés depuis son prix en yuan. */
export type ChampsPrix = Pick<Moto, "prix_ttc" | "prix_yuan" | "taux_yuan" | "acompte_pct">;

export function champsPrix(prixYuan: number | null, r: Reglages, g: Gabarit): ChampsPrix {
  if (!prixYuan) return { prix_ttc: 0, prix_yuan: null, taux_yuan: null, acompte_pct: null };
  const c = calculerPrix(prixYuan, r, g);
  return { prix_ttc: c.prix_ar, prix_yuan: prixYuan, taux_yuan: r.taux_yuan, acompte_pct: c.acompte_pct };
}

/** La moto a-t-elle un prix à jour avec ces réglages ? */
export function prixAJour(
  m: Pick<Moto, "prix_ttc" | "prix_yuan" | "acompte_pct" | "categorie" | "cylindree" | "volume_m3" | "marge_ar">,
  r: Reglages
): boolean {
  if (!m.prix_yuan) return true;
  const attendu = champsPrix(m.prix_yuan, r, m);
  return attendu.prix_ttc === m.prix_ttc && attendu.acompte_pct === m.acompte_pct;
}

export type { Reglages, Statut };
