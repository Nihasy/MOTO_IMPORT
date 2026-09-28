import type { MotoAvecMedias } from "@/lib/types";
import { appliquerFiltres, trierCatalogue, TRIS, type Ordre } from "@/lib/db/filtres";

/**
 * Cartes envoyees par tranche. Le catalogue entier partait d'un bloc : 2 Mo de
 * page et une centaine de photos, que Safari sur iPhone finissait par
 * abandonner. Dix-huit cartes remplissent plusieurs ecrans, sur une, deux ou
 * trois colonnes, avant que la tranche suivante soit demandee.
 */
export const CARTES_PAR_TRANCHE = 18;

/** Nombre de vues transportees par carte, aligne sur la galerie au balayage. */
const VUES_PAR_CARTE = 5;

const liste = (v: string | undefined) =>
  (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * Filtre et trie le catalogue d'apres les parametres de l'URL. La page et la
 * route des tranches suivantes passent toutes deux par ici : si elles
 * calculaient l'ordre chacune de leur cote, le defilement pourrait sauter ou
 * repeter une moto.
 */
export function selectionCatalogue(
  toutes: MotoAvecMedias[],
  lire: (cle: string) => string | undefined
): MotoAvecMedias[] {
  // Tri demande dans l'URL, ramene aux valeurs connues : un parametre bricole
  // ne doit pas changer l'ordre de la liste.
  const triDemande = lire("tri") ?? "date";
  const tri = triDemande in TRIS ? triDemande : "date";
  const ordre: Ordre = lire("ordre") === "asc" ? "asc" : "desc";
  const nombre = (cle: string) => (lire(cle) ? Number(lire(cle)) : undefined);

  return trierCatalogue(
    appliquerFiltres(toutes, {
      categorie: liste(lire("cat")).length ? liste(lire("cat")) : undefined,
      etat: lire("etat"),
      prixMax: nombre("max"),
      prixMin: nombre("min"),
      marques: liste(lire("marque")).length ? liste(lire("marque")) : undefined,
      cylindrees: liste(lire("cc")).length ? liste(lire("cc")) : undefined,
      anneeMin: nombre("annee_min"),
      anneeMax: nombre("annee_max"),
      masquerVendues: lire("masquer_vendues") === "1",
      recherche: lire("q"),
    }),
    tri,
    ordre
  );
}

/**
 * Une tranche prete pour les cartes. La galerie de carte n'affiche que cinq
 * vues : transporter les douze alourdit la page sans rien montrer de plus.
 */
export function trancheCatalogue(selection: MotoAvecMedias[], depuis: number): MotoAvecMedias[] {
  return selection
    .slice(depuis, depuis + CARTES_PAR_TRANCHE)
    .map((m) => ({ ...m, medias: m.medias.slice(0, VUES_PAR_CARTE), nb_medias: m.medias.length }));
}
