import type { Moto, Statut } from "./types";
import { POIDS_STATUT, miseEnVenteDe } from "./types";

/**
 * Fiche de stock remise à un fournisseur : la liste des motos que nous
 * proposons sur commande de son stock, pour qu'il coche ce qu'il a encore.
 *
 * Seules comptent les motos publiées et parties sur commande. Une moto déjà
 * au local ne dépend plus de lui, et un brouillon n'a encore été proposé à
 * personne.
 */
export const STATUTS_STOCK = ["disponible", "reserve", "vendu"] as const satisfies readonly Statut[];

export const LIBELLE_STOCK: Record<(typeof STATUTS_STOCK)[number], { fr: string; zh: string }> = {
  disponible: { fr: "En vente", zh: "在售" },
  reserve: { fr: "Réservée", zh: "已预订" },
  vendu: { fr: "Vendue", zh: "已售" },
};

export function motosDuStock<T extends Pick<Moto, "fournisseur_id" | "statut" | "mise_en_vente" | "reference">>(
  motos: T[],
  fournisseurId: string
): (T & { statut: (typeof STATUTS_STOCK)[number] })[] {
  return motos
    .filter(
      (m): m is T & { statut: (typeof STATUTS_STOCK)[number] } =>
        m.fournisseur_id === fournisseurId &&
        (STATUTS_STOCK as readonly Statut[]).includes(m.statut) &&
        miseEnVenteDe(m) === "commande"
    )
    .sort((a, b) => POIDS_STATUT[a.statut] - POIDS_STATUT[b.statut] || a.reference.localeCompare(b.reference));
}

/**
 * Première phrase de la description, bornée : la fiche est un tableau à
 * annoter, pas une annonce, et une ligne trop haute pousse la suivante sur
 * une autre page.
 */
export function descriptionCourte(description: string, max = 140): string {
  const texte = description.replace(/\s+/g, " ").trim();
  const phrase = texte.match(/^.+?[.!?](\s|$)/)?.[0].trim() ?? texte;
  return phrase.length <= max ? phrase : `${phrase.slice(0, max - 1).trimEnd()}…`;
}
