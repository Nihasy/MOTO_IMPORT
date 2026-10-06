import type { MotoAvecMedias } from "@/lib/types";
import { appliquerFiltres, trierCatalogue, TRIS, type Ordre } from "@/lib/db/filtres";
import { rechercherMotos, trierParPertinence } from "@/lib/recherche";

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

/** Ce que la page a besoin de savoir d'une recherche, au-delà de la liste. */
export type ResultatCatalogue = {
  /** Motos à afficher, filtrées et triées. */
  motos: MotoAvecMedias[];
  /** La recherche stricte ne rendait rien : ce sont les plus proches. */
  approximatif: boolean;
  /**
   * Motos qui répondent au texte, avant les autres filtres. La feuille de
   * filtres compte sur elles : sans cela, elle annonçait « Voir 40 motos »
   * pendant qu'une recherche n'en laissait que trois.
   */
  correspondantes: MotoAvecMedias[];
  /** Tri réellement appliqué : « pertinence » dès qu'il y a du texte, sauf demande contraire. */
  tri: string;
};

/**
 * Filtre et trie le catalogue d'apres les parametres de l'URL. La page et la
 * route des tranches suivantes passent toutes deux par ici : si elles
 * calculaient l'ordre chacune de leur cote, le defilement pourrait sauter ou
 * repeter une moto.
 */
export function rechercheCatalogue(
  toutes: MotoAvecMedias[],
  lire: (cle: string) => string | undefined
): ResultatCatalogue {
  const { trouvees, approximatif, jetons } = rechercherMotos(toutes, lire("q"));
  const notes = new Map(trouvees.map((t) => [t.moto.id, t.note]));
  const correspondantes = trouvees.map((t) => t.moto);

  // Tri demande dans l'URL, ramene aux valeurs connues : un parametre bricole
  // ne doit pas changer l'ordre de la liste. La pertinence n'a de sens qu'avec
  // un texte ; elle devient le tri par défaut dès qu'il y en a un.
  const avecTexte = jetons.length > 0;
  const triDemande = lire("tri");
  const tri =
    triDemande && triDemande in TRIS && (triDemande !== "pertinence" || avecTexte)
      ? triDemande
      : avecTexte
        ? "pertinence"
        : "date";
  const ordre: Ordre = lire("ordre") === "asc" ? "asc" : "desc";
  const nombre = (cle: string) => (lire(cle) ? Number(lire(cle)) : undefined);

  const filtrees = appliquerFiltres(correspondantes, {
    categorie: liste(lire("cat")).length ? liste(lire("cat")) : undefined,
    etat: lire("etat"),
    prixMax: nombre("max"),
    prixMin: nombre("min"),
    marques: liste(lire("marque")).length ? liste(lire("marque")) : undefined,
    cylindrees: liste(lire("cc")).length ? liste(lire("cc")) : undefined,
    anneeMin: nombre("annee_min"),
    anneeMax: nombre("annee_max"),
    masquerVendues: lire("masquer_vendues") === "1",
  });

  const motos =
    tri === "pertinence"
      ? trierParPertinence(filtrees, (m) => notes.get(m.id) ?? 0)
      : trierCatalogue(filtrees, tri, ordre);
  return { motos, approximatif, correspondantes, tri };
}

/** Liste seule, pour qui n'a besoin que des motos dans l'ordre. */
export function selectionCatalogue(
  toutes: MotoAvecMedias[],
  lire: (cle: string) => string | undefined
): MotoAvecMedias[] {
  return rechercheCatalogue(toutes, lire).motos;
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
