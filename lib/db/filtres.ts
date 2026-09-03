import type { MotoAvecMedias, MotoPublique } from "@/lib/types";
import { POIDS_STATUT, estPublic } from "@/lib/types";
import type { FiltresCatalogue } from "./types";

export const TRANCHES_CC: Record<string, [number, number]> = {
  "250-400": [250, 400],
  "400-650": [401, 650],
  "650-1000": [651, 1000],
  "1000+": [1001, 100000],
};

/**
 * Projection minimale que `appliquerFiltres` consulte reellement. La feuille de
 * filtres compte les resultats cote client : elle recoit cette forme allegee
 * plutot que tout le catalogue avec ses medias.
 */
export type MotoFiltrable = Pick<
  MotoPublique,
  "categorie" | "etat" | "prix_ttc" | "marque" | "cylindree" | "annee" | "statut" | "modele" | "reference"
>;

export function appliquerFiltres<T extends MotoFiltrable>(motos: T[], f: FiltresCatalogue = {}): T[] {
  return motos.filter((m) => {
    if (!estPublic(m.statut)) return false;
    if (f.categorie?.length && !f.categorie.includes(m.categorie)) return false;
    if (f.etat && f.etat !== "tous" && m.etat !== f.etat) return false;
    if (f.prixMax !== undefined && m.prix_ttc > f.prixMax) return false;
    if (f.prixMin !== undefined && m.prix_ttc < f.prixMin) return false;
    if (f.marques?.length && !f.marques.map((x) => x.toLowerCase()).includes(m.marque.toLowerCase())) return false;
    if (f.cylindrees?.length) {
      const ok = f.cylindrees.some((c) => {
        const t = TRANCHES_CC[c];
        return t ? m.cylindree >= t[0] && m.cylindree <= t[1] : false;
      });
      if (!ok) return false;
    }
    if (f.anneeMin !== undefined && m.annee < f.anneeMin) return false;
    if (f.anneeMax !== undefined && m.annee > f.anneeMax) return false;
    if (f.masquerVendues && m.statut === "vendu") return false;
    if (f.recherche) {
      const q = f.recherche.toLowerCase().trim();
      const hay = `${m.marque} ${m.modele} ${m.reference}`.toLowerCase();
      if (!q.split(/\s+/).every((mot) => hay.includes(mot))) return false;
    }
    return true;
  });
}

/** Criteres de tri proposes au catalogue, dans l'ordre du selecteur. */
export const TRIS: Record<string, string> = {
  date: "Nouveautés",
  prix: "Prix",
  cylindree: "Cylindrée",
  annee: "Année",
};

export type Tri = keyof typeof TRIS;
export type Ordre = "asc" | "desc";

/**
 * disponible, puis réservé, puis vendu ; à statut égal, le critere demande.
 * Le statut prime toujours : une moto vendue ne doit pas remonter en tete
 * parce qu'elle est la moins chere. Par defaut, le plus récent d'abord.
 */
export function trierCatalogue<T extends MotoPublique>(
  motos: T[],
  tri: Tri = "date",
  ordre: Ordre = "desc"
): T[] {
  const sens = ordre === "asc" ? 1 : -1;
  return [...motos].sort((a, b) => {
    const d = POIDS_STATUT[a.statut] - POIDS_STATUT[b.statut];
    if (d !== 0) return d;
    switch (tri) {
      case "prix":
        return (a.prix_ttc - b.prix_ttc) * sens;
      case "cylindree":
        return (a.cylindree - b.cylindree) * sens;
      case "annee":
        return (a.annee - b.annee) * sens;
      default:
        return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * sens;
    }
  });
}

export function similaires(
  toutes: MotoAvecMedias[],
  ref: MotoAvecMedias,
  n = 3
): MotoAvecMedias[] {
  return toutes
    .filter((m) => m.id !== ref.id && estPublic(m.statut))
    .map((m) => {
      let score = 0;
      if (m.categorie === ref.categorie) score += 3;
      if (m.etat === ref.etat) score += 1;
      if (m.marque.toLowerCase() === ref.marque.toLowerCase()) score += 2;
      const ecartCc = Math.abs(m.cylindree - ref.cylindree);
      if (ecartCc < 150) score += 2;
      else if (ecartCc < 350) score += 1;
      const ecartPrix = Math.abs(m.prix_ttc - ref.prix_ttc) / Math.max(ref.prix_ttc, 1);
      if (ecartPrix < 0.2) score += 2;
      else if (ecartPrix < 0.4) score += 1;
      if (m.statut === "disponible") score += 1;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.m);
}
