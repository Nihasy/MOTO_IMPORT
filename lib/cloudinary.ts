import type { Origine } from "./types";

export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

/**
 * Public id du filigrane téléversé sur Cloudinary. L'image est fabriquée par
 * `npm run filigrane` puis déposée une fois pour toutes dans la bibliothèque
 * Cloudinary. Sans elle, on retombe sur une simple incrustation de texte.
 */
export const FILIGRANE_ID = process.env.NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID ?? "";

/** Marque servie par le site lui-même, pour l'incrustation navigateur et CSS. */
export const FILIGRANE_SRC = "/filigrane.png";
export const FILIGRANE_RATIO = 1001 / 240;

/**
 * Géométrie commune aux trois moteurs de rendu — Cloudinary, canvas d'envoi et
 * surcouche CSS. Une seule marque, trois façons de la poser : elles doivent
 * tomber au même endroit, à la même taille.
 */
export const FILIGRANE_LARGEUR = 0.3; // part de la largeur de la photo
export const FILIGRANE_MARGE = 0.02;
export const FILIGRANE_OPACITE = 0.82;

export type Usage = "vignette" | "carte" | "galerie" | "plein";

const PRESETS: Record<Usage, string> = {
  vignette: "c_fill,ar_4:3,w_200,f_auto,q_auto",
  carte: "c_fill,ar_4:3,w_800,f_auto,q_auto:good",
  galerie: "c_fill,ar_4:3,w_1400,f_auto,q_auto:good",
  plein: "c_limit,w_2400,f_auto,q_auto:best",
};

const FOND_NEUTRE = "b_rgb:171C21";

/**
 * Le filigrane ne couvre que nos propres clichés (7.5) : marquer un visuel
 * constructeur reviendrait à s'attribuer une image qui n'est pas de nous. Il
 * est également inutile sur la vignette de 200 px, qui ne sort jamais du
 * back-office et où la marque serait de toute façon illisible.
 */
const marquable = (usage: Usage, origine?: Origine) => origine === "reelle" && usage !== "vignette";

/**
 * Une transformation n'est possible que sur un média hébergé par Cloudinary.
 * Sont donc écartés : les URL déjà complètes, les data URL, et les chemins du
 * site lui-même — les photos de démonstration `/demo/1.jpeg` sont enregistrées
 * dans `cloudinary_id`, et les coller derrière un identifiant Cloudinary
 * produirait une URL à double barre qui ne résout rien.
 */
const transformable = (cloudinaryId: string) =>
  Boolean(CLOUD_NAME) && !/^(https?|data):/.test(cloudinaryId) && !cloudinaryId.startsWith("/");

/**
 * Vrai quand `urlMedia` rend une adresse Cloudinary pour ce média, déjà mise à
 * la bonne taille et au bon format (`f_auto,q_auto`). `next/image` doit alors
 * la servir telle quelle (`unoptimized`) : sans quoi chaque photo repasse par
 * l'optimiseur d'images de Vercel — un second traitement de la même image,
 * décompté sur le quota mensuel de l'offre gratuite de Vercel, pour un
 * résultat que Cloudinary a déjà produit.
 */
export const servieParCloudinary = (cloudinaryId: string) => transformable(cloudinaryId);

/**
 * Incrustation du filigrane par Cloudinary. Les barres obliques d'un public id
 * s'écrivent en deux-points dans une couche. `fl_relative` rend la largeur
 * proportionnelle à la photo : la marque garde la même emprise sur une carte
 * de 800 px et sur un plein écran de 2400 px.
 *
 * Le cahier des charges (7.5) plaçait la marque en bas à droite. C'est le coin
 * déjà occupé par le compteur « 3/12 » des deux galeries ; une marque large de
 * 30 % viendrait s'y superposer. Elle passe donc en bas à gauche, aux trois
 * endroits où elle est posée, pour que Cloudinary et la surcouche CSS tombent
 * exactement au même point.
 */
function couche(): string {
  if (FILIGRANE_ID) {
    const id = FILIGRANE_ID.replace(/\//g, ":");
    const opacite = Math.round(FILIGRANE_OPACITE * 100);
    return `l_${id},w_${FILIGRANE_LARGEUR},fl_relative,o_${opacite},g_south_west,x_18,y_16`;
  }
  return "l_text:Arial_28_bold:MOTO%20IMPORT,co_rgb:FFFFFFCC,g_south_west,x_24,y_18";
}

/**
 * URL Cloudinary derivee. En l'absence de cloud configure, `cloudinary_id`
 * est traite comme une URL directe (utile en developpement et pour les tests).
 */
export function urlMedia(
  cloudinaryId: string,
  usage: Usage = "carte",
  opts: { origine?: Origine } = {}
): string {
  // Toute valeur deja porteuse d'un schema (http, https, data) est servie telle
  // quelle : utile en developpement et pour le repli sans Cloudinary.
  if (!transformable(cloudinaryId)) return cloudinaryId;
  const parts = [PRESETS[usage]];
  if (marquable(usage, opts.origine)) parts.push(couche());
  if (opts.origine === "constructeur") parts.push(FOND_NEUTRE);
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${parts.join("/")}/${cloudinaryId}`;
}

/**
 * Vrai quand l'URL servie porte déjà la marque dans ses pixels. L'interface s'en
 * sert pour ne pas en superposer une seconde par-dessus : deux filigranes au
 * même coin se chevauchent et donnent une image sale.
 */
export function filigraneIncruste(
  cloudinaryId: string,
  usage: Usage = "carte",
  opts: { origine?: Origine } = {}
): boolean {
  return transformable(cloudinaryId) && marquable(usage, opts.origine);
}

/**
 * Faut-il incruster la marque au moment de l'envoi ? Oui dès qu'aucune
 * transformation Cloudinary ne viendra la poser à la livraison — sans quoi le
 * fichier stocké, celui qu'un téléchargement rapporte, partirait nu.
 */
export const filigraneALEnvoi = (origine: Origine): boolean => origine === "reelle" && !CLOUD_NAME;

export const LARGEURS: Record<Usage, number> = {
  vignette: 200,
  carte: 800,
  galerie: 1400,
  plein: 2400,
};
