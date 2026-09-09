import type { Moto, Statut, Vue } from "./types";
import { estPublic } from "./types";

export type LigneAdmin = Pick<
  Moto,
  "reference" | "marque" | "modele" | "annee" | "statut" | "etat"
> & { nb_photos: number; vues_manquantes: Vue[] };

/**
 * Groupes de statut du back-office.
 *
 * Ils ne recopient pas l'énumération : ce qui compte à l'exploitation, c'est
 * « ce qui est en ligne », « ce que je prépare » et « ce qui est cassé », pas
 * la distinction entre `disponible` et `dispo_immediate`.
 */
export const GROUPES_ADMIN = {
  tous: "Toutes",
  brouillon: "Brouillons",
  en_ligne: "En ligne",
  vendu: "Vendues",
  incompletes: "Incomplètes",
  archive: "Archivées",
} as const;

export type GroupeAdmin = keyof typeof GROUPES_ADMIN;

export const estGroupeAdmin = (v: string | undefined): v is GroupeAdmin =>
  Boolean(v && v in GROUPES_ADMIN);

/**
 * « Incomplète » se juge sur le plan de prise de vue, jamais sur un nombre de
 * photos : les lots reçus des ateliers en comptent un nombre variable, et une
 * fiche à quinze clichés qui n'en montre aucun du compteur reste incomplète.
 */
const photosManquantes = (vues: Vue[]) => vues.length > 0;

export function appartientAuGroupe(
  ligne: { statut: Statut; vues_manquantes: Vue[] },
  groupe: GroupeAdmin
): boolean {
  switch (groupe) {
    case "brouillon":
      return ligne.statut === "brouillon";
    case "en_ligne":
      return estPublic(ligne.statut) && ligne.statut !== "vendu";
    case "vendu":
      return ligne.statut === "vendu";
    case "archive":
      return ligne.statut === "archive";
    case "incompletes":
      return photosManquantes(ligne.vues_manquantes);
    default:
      return true;
  }
}

/**
 * Recherche par référence, marque, modèle ou année. Chaque mot doit être
 * présent : taper « honda 2023 » restreint au lieu d'élargir, ce qui est le
 * comportement attendu quand on cherche une fiche précise.
 */
export function correspondRecherche(ligne: LigneAdmin, q: string): boolean {
  const termes = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!termes.length) return true;
  const botte = `${ligne.reference} ${ligne.marque} ${ligne.modele} ${ligne.annee}`.toLowerCase();
  return termes.every((t) => botte.includes(t));
}

export function filtrerMotosAdmin<T extends LigneAdmin>(
  motos: T[],
  { q, groupe }: { q?: string; groupe?: GroupeAdmin } = {}
): T[] {
  return motos.filter(
    (m) =>
      (!groupe || appartientAuGroupe(m, groupe)) && (!q || correspondRecherche(m, q))
  );
}

/** Effectifs par groupe, pour afficher le compte sur chaque puce de filtre. */
export function effectifsAdmin<T extends LigneAdmin>(motos: T[]): Record<GroupeAdmin, number> {
  const cles = Object.keys(GROUPES_ADMIN) as GroupeAdmin[];
  return Object.fromEntries(
    cles.map((g) => [g, motos.filter((m) => appartientAuGroupe(m, g)).length])
  ) as Record<GroupeAdmin, number>;
}
