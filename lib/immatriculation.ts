import type { Categorie } from "./types";

/**
 * La carte grise incluse suppose une moto homologuée pour la route. Une moto de
 * cross ne l'est pas : aucune préfecture n'immatricule une Kayo K6R ou une BSE
 * X8, et leur fiche promettait pourtant, comme toutes les autres, « carte grise
 * établie à votre nom ». Le client l'aurait découvert au retrait (CGV 7.4).
 *
 * La règle tient à la catégorie et non à une colonne : les versions de route
 * d'une même gamme (Hengjian S5 immatriculable, XGZ F1) sont rangées en
 * « trail », et gardent la carte grise. Une seule fonction, pour que la fiche,
 * la carte du catalogue, l'image de partage et les métadonnées disent la même
 * chose.
 */
export const immatriculable = (moto: { categorie: Categorie }) => moto.categorie !== "motocross";

/** Mention courte, pour la carte du catalogue et l'image de partage. */
export const mentionCarteGrise = (moto: { categorie: Categorie }) =>
  immatriculable(moto) ? "Carte grise à votre nom incluse" : "Hors route, sans carte grise";

/** Mention de la fiche, sous le prix. */
export const phraseCarteGrise = (moto: { categorie: Categorie }) =>
  immatriculable(moto)
    ? "Carte grise établie à votre nom, incluse."
    : "Moto de cross non homologuée pour la route : vendue sans carte grise.";
