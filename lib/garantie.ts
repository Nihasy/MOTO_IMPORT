import type { MotoPublique } from "./types";

export type LigneGarantie = { titre: string; texte: string };

type Couverture = Pick<MotoPublique, "etat" | "garantie_mois" | "garantie_texte">;

/**
 * SAV : seul un véhicule neuf peut être garanti, et seulement si une durée a
 * été saisie — les termes sont ceux de la marque et du concessionnaire
 * d'origine, ils varient d'un modèle à l'autre.
 *
 * Une occasion est vendue en l'état. Sa fiche ne porte alors **aucune** mention
 * de garantie : ni ligne de réassurance, ni ligne de fiche technique, ni
 * rappel. Afficher « aucune garantie » attire l'œil sur un manque là où le
 * silence est neutre ; l'honnêteté sur l'occasion passe par les points d'usure
 * listés et les photos datées, pas par une case vide.
 */
const estCouvert = (m: Couverture): boolean => m.etat === "neuf" && m.garantie_mois > 0;

/** Valeur de la ligne « Garantie » en fiche technique, ou `null` si sans objet. */
export function garantieCourte(moto: Couverture): string | null {
  if (!estCouvert(moto)) return null;
  return moto.garantie_texte
    ? `${moto.garantie_mois} mois — ${moto.garantie_texte}`
    : `${moto.garantie_mois} mois`;
}

/** Ligne de réassurance, ou `null` si le véhicule n'est pas couvert. */
export function garantieFiche(moto: Couverture): LigneGarantie | null {
  if (!estCouvert(moto)) return null;
  return {
    titre: `Garantie ${moto.garantie_mois} mois`,
    texte: moto.garantie_texte
      ? `${moto.garantie_texte}. Durée et organes couverts fixés par la marque et le concessionnaire d'origine.`
      : "Durée et organes couverts fixés par la marque et le concessionnaire d'origine.",
  };
}
