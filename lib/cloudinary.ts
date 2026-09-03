export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export type Usage = "vignette" | "carte" | "galerie" | "plein";

const PRESETS: Record<Usage, string> = {
  vignette: "c_fill,ar_4:3,w_200,f_auto,q_auto",
  carte: "c_fill,ar_4:3,w_800,f_auto,q_auto:good",
  galerie: "c_fill,ar_4:3,w_1400,f_auto,q_auto:good",
  plein: "c_limit,w_2400,f_auto,q_auto:best",
};

const FILIGRANE = "l_text:Arial_28_bold:MOTO%20IMPORT,co_rgb:FFFFFFAA,g_south_east,x_24,y_18";
const FOND_NEUTRE = "b_rgb:171C21";

/**
 * URL Cloudinary derivee. En l'absence de cloud configure, `cloudinary_id`
 * est traite comme une URL directe (utile en developpement et pour les tests).
 */
export function urlMedia(
  cloudinaryId: string,
  usage: Usage = "carte",
  opts: { origine?: "reelle" | "constructeur" } = {}
): string {
  // Toute valeur deja porteuse d'un schema (http, https, data) est servie telle
  // quelle : utile en developpement et pour le repli sans Cloudinary.
  if (!CLOUD_NAME || /^(https?|data):/.test(cloudinaryId)) return cloudinaryId;
  const parts = [PRESETS[usage]];
  if (opts.origine === "reelle" && usage !== "vignette") parts.push(FILIGRANE);
  if (opts.origine === "constructeur") parts.push(FOND_NEUTRE);
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${parts.join("/")}/${cloudinaryId}`;
}

export const LARGEURS: Record<Usage, number> = {
  vignette: 200,
  carte: 800,
  galerie: 1400,
  plein: 2400,
};
