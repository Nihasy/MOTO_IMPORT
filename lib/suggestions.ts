import { filigraneIncruste, servieParCloudinary, urlMedia } from "@/lib/cloudinary";
import { CATEGORIES, LIBELLE_CATEGORIE, estPublic, type Categorie, type Etat, type MotoAvecMedias, type Statut } from "@/lib/types";
import {
  SYNONYMES_CATEGORIE, creerNoteur, decouper, preparerChamps, rechercherMotos, trierParPertinence,
} from "@/lib/recherche";

/**
 * Ce que la boîte de recherche montre pendant la frappe. Projection explicite,
 * champ par champ : une suggestion part vers n'importe quel visiteur, et un
 * `...moto` y aurait emmené tout ce que l'objet porte côté serveur.
 */
export type SuggestionMoto = {
  slug: string;
  marque: string;
  modele: string;
  annee: number;
  cylindree: number;
  etat: Etat;
  statut: Statut;
  prix_ttc: number;
  photo: { src: string; cloudinary: boolean; marquee: boolean } | null;
};

export type Suggestions = {
  motos: SuggestionMoto[];
  /** Marques qui répondent à tout le texte : « kaw » propose « Kawasaki ». */
  marques: { nom: string; effectif: number }[];
  /** Types qui répondent à tout le texte : « naked » propose « Roadster ». */
  categories: { cle: Categorie; libelle: string; effectif: number }[];
  total: number;
  approximatif: boolean;
};

export const SUGGESTIONS_VIDES: Suggestions = { motos: [], marques: [], categories: [], total: 0, approximatif: false };

/** Six motos au plus : au-delà, la liste déborde d'un écran de téléphone. */
const MAX_MOTOS = 6;

export function suggerer(toutes: MotoAvecMedias[], q: string): Suggestions {
  const jetons = decouper(q);
  if (!jetons.length) return SUGGESTIONS_VIDES;
  const publiques = toutes.filter((m) => estPublic(m.statut));
  const { trouvees, approximatif } = rechercherMotos(publiques, q);
  const notes = new Map(trouvees.map((t) => [t.moto.id, t.note]));
  const ordonnees = trierParPertinence(
    trouvees.map((t) => t.moto),
    (m) => notes.get(m.id) ?? 0
  );

  // Une marque ou un type n'est proposé que s'il répond à toute la requête :
  // « honda cb » ne doit pas proposer « toutes les Honda ».
  const noter = creerNoteur(jetons);
  const repond = (texte: string) => noter(preparerChamps([{ texte, poids: 1, formes: true }])) > 0;

  const parMarque = new Map<string, number>();
  const parType = new Map<Categorie, number>();
  if (!approximatif) {
    for (const m of ordonnees) {
      parMarque.set(m.marque, (parMarque.get(m.marque) ?? 0) + 1);
      parType.set(m.categorie, (parType.get(m.categorie) ?? 0) + 1);
    }
  }
  const marques = [...parMarque.entries()]
    .filter(([nom]) => repond(nom))
    .map(([nom, effectif]) => ({ nom, effectif }))
    .sort((a, b) => b.effectif - a.effectif)
    .slice(0, 2);
  const categories = CATEGORIES.filter((c) => parType.has(c) && repondType(c, repond))
    .map((cle) => ({ cle, libelle: LIBELLE_CATEGORIE[cle], effectif: parType.get(cle)! }))
    .slice(0, 2);

  return {
    motos: ordonnees.slice(0, MAX_MOTOS).map(projeter),
    marques,
    categories,
    total: ordonnees.length,
    approximatif,
  };
}

/** Le type répond s'il répond par son libellé ou par l'un de ses noms courants. */
function repondType(c: Categorie, repond: (texte: string) => boolean): boolean {
  return repond(`${LIBELLE_CATEGORIE[c]} ${SYNONYMES_CATEGORIE[c]}`);
}

function projeter(m: MotoAvecMedias): SuggestionMoto {
  const p = m.medias.find((x) => x.type === "photo");
  return {
    slug: m.slug,
    marque: m.marque,
    modele: m.modele,
    annee: m.annee,
    cylindree: m.cylindree,
    etat: m.etat,
    statut: m.statut,
    prix_ttc: m.prix_ttc,
    // La miniature porte la marque, comme toute image publiée (décision du
    // 23/09/2026) ; seule la vignette du back-office en est exemptée.
    photo: p
      ? {
          src: urlMedia(p.cloudinary_id, "miniature", { origine: p.origine }),
          cloudinary: servieParCloudinary(p.cloudinary_id),
          marquee: filigraneIncruste(p.cloudinary_id, "miniature", { origine: p.origine }),
        }
      : null,
  };
}
