import "server-only";

/**
 * Envoi vers la page Facebook par l'API Graph.
 *
 * Deux variables Vercel : `FACEBOOK_PAGE_ID` et `FACEBOOK_PAGE_TOKEN`, un jeton
 * de Page longue durée portant `pages_manage_posts` et `pages_read_engagement`.
 * Sans elles, le Studio se replie sur le kit à télécharger : rien ne part.
 */

const VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v23.0";
const RACINE = `https://graph.facebook.com/${VERSION}`;

export const facebookConfigure = (): boolean =>
  Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_TOKEN);

function identifiants() {
  const page = process.env.FACEBOOK_PAGE_ID;
  const jeton = process.env.FACEBOOK_PAGE_TOKEN;
  if (!page || !jeton) throw new Error("Publication Facebook non configurée (FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN).");
  return { page, jeton };
}

/**
 * Appel POST. Le jeton part dans le corps et jamais dans l'URL : une URL finit
 * dans les journaux de Vercel, un corps non.
 */
async function poster(chemin: string, corps: FormData): Promise<Record<string, unknown>> {
  corps.set("access_token", identifiants().jeton);
  const rep = await fetch(`${RACINE}/${chemin}`, { method: "POST", body: corps });
  const json = (await rep.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string; code?: number };
  };
  if (!rep.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${rep.status}`;
    throw new Error(`Facebook a refusé l'appel : ${msg}`);
  }
  return json;
}

/**
 * Téléverse une photo sans la publier, avec sa légende propre. `temporary` est
 * exigé par Facebook pour une photo destinée à un post programmé : sans lui,
 * la photo est rejetée au moment de la programmation.
 */
async function televerserPhoto(png: ArrayBuffer, legende: string, nom: string, programme: boolean): Promise<string> {
  const corps = new FormData();
  corps.set("source", new Blob([png], { type: "image/png" }), nom);
  corps.set("caption", legende);
  corps.set("published", "false");
  if (programme) corps.set("temporary", "true");
  const r = await poster(`${identifiants().page}/photos`, corps);
  return String(r.id);
}

export type PhotoAlbum = { png: ArrayBuffer; legende: string; nom: string };

/**
 * Publie (ou programme) un post multi-photos : chaque photo garde sa légende,
 * visible quand on l'ouvre, et le texte du post coiffe l'ensemble.
 *
 * Les photos montent une à une : en parallèle, Facebook renvoie par moments
 * une erreur de débit sur la même Page, et un album à moitié téléversé ne se
 * reprend pas proprement.
 */
export async function publierAlbum(opts: {
  message: string;
  photos: PhotoAlbum[];
  programmeLe?: Date | null;
}): Promise<{ postId: string; lien: string }> {
  const programme = Boolean(opts.programmeLe);
  const ids: string[] = [];
  for (const p of opts.photos) ids.push(await televerserPhoto(p.png, p.legende, p.nom, programme));

  const corps = new FormData();
  corps.set("message", opts.message);
  ids.forEach((id, i) => corps.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  if (opts.programmeLe) {
    corps.set("published", "false");
    corps.set("scheduled_publish_time", String(Math.floor(opts.programmeLe.getTime() / 1000)));
  }
  const r = await poster(`${identifiants().page}/feed`, corps);
  const postId = String(r.id);
  return { postId, lien: lienPost(postId) };
}

export async function commenter(postId: string, message: string): Promise<void> {
  const corps = new FormData();
  corps.set("message", message);
  await poster(`${postId}/comments`, corps);
}

/** `PAGEID_POSTID`, la forme renvoyée par l'API, s'ouvre telle quelle. */
export const lienPost = (postId: string) => `https://www.facebook.com/${postId}`;
