import { createHash } from "node:crypto";
import { selIp } from "./config";

/** Adresse IP jamais stockée en clair (12.3). */
export function hacherIp(ip: string): string {
  return createHash("sha256").update(selIp() + ip).digest("hex").slice(0, 32);
}

/**
 * Adresse du client.
 *
 * `x-forwarded-for` est ajouté par le client autant que par les relais : sa
 * première entrée est librement falsifiable et ne doit jamais servir de clé
 * de limitation. On privilégie les en-têtes posés par la plateforme, puis la
 * dernière entrée de la chaîne — celle écrite par le relais le plus proche.
 */
export function ipDepuisEntetes(h: Headers): string {
  const plateforme = h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip");
  if (plateforme) return plateforme.split(",")[0].trim();

  const chaine = h.get("x-forwarded-for");
  if (chaine) {
    const entrees = chaine.split(",").map((s) => s.trim()).filter(Boolean);
    if (entrees.length) return entrees[entrees.length - 1];
  }
  return "0.0.0.0";
}

type Fenetre = { compte: number; debut: number };

const MAX_ENTREES = 20_000;
const compteurs = new Map<string, Fenetre>();

/** Purge les fenêtres expirées, et borne la taille de la table. */
function entretenir(maintenant: number, fenetreMs: number) {
  if (compteurs.size < MAX_ENTREES) return;
  for (const [cle, f] of compteurs) {
    if (maintenant - f.debut > fenetreMs) compteurs.delete(cle);
  }
  // Toujours saturée après purge : on évince les plus anciennes entrées
  // insérées. Sans cette borne, une rotation d'adresses suffirait à épuiser
  // la mémoire du processus.
  if (compteurs.size >= MAX_ENTREES) {
    const aRetirer = compteurs.size - Math.floor(MAX_ENTREES * 0.8);
    let i = 0;
    for (const cle of compteurs.keys()) {
      if (i++ >= aRetirer) break;
      compteurs.delete(cle);
    }
  }
}

export type Verdict = { autorise: boolean; restant: number; resetDans: number };

/**
 * Limitation de débit en mémoire.
 *
 * Limite du procédé : le compteur est local à l'instance. Derrière plusieurs
 * instances serverless, la limite effective est multipliée par leur nombre.
 * Pour une protection stricte, brancher un compteur partagé (Vercel KV,
 * Upstash) sur cette même interface.
 */
export function limiterDebit(cle: string, max = 5, fenetreMs = 60_000): Verdict {
  const maintenant = Date.now();
  entretenir(maintenant, fenetreMs);

  const f = compteurs.get(cle);
  if (!f || maintenant - f.debut > fenetreMs) {
    compteurs.set(cle, { compte: 1, debut: maintenant });
    return { autorise: true, restant: max - 1, resetDans: fenetreMs };
  }
  f.compte += 1;
  const resetDans = fenetreMs - (maintenant - f.debut);
  if (f.compte > max) return { autorise: false, restant: 0, resetDans };
  return { autorise: true, restant: max - f.compte, resetDans };
}

/**
 * Limitation à deux étages : par adresse, et globale sur l'ensemble du trafic.
 *
 * L'étage global est la seule défense qui tienne si l'attaquant falsifie son
 * adresse source : quel que soit le nombre d'adresses qu'il présente, le
 * volume total admis reste borné.
 */
export function limiterDebitDouble(
  prefixe: string,
  ip: string,
  parIp: { max: number; fenetreMs: number },
  global: { max: number; fenetreMs: number }
): Verdict & { motif?: "ip" | "global" } {
  const parAdresse = limiterDebit(`${prefixe}:ip:${ip}`, parIp.max, parIp.fenetreMs);
  if (!parAdresse.autorise) return { ...parAdresse, motif: "ip" };

  const globalement = limiterDebit(`${prefixe}:global`, global.max, global.fenetreMs);
  if (!globalement.autorise) return { ...globalement, motif: "global" };

  return parAdresse;
}

export function viderLimiteur() {
  compteurs.clear();
}

export function tailleLimiteur() {
  return compteurs.size;
}

export const erreur = (message: string, champ?: string) =>
  Response.json(champ ? { erreur: message, champ } : { erreur: message }, { status: 400 });

/** Réponse normalisée de dépassement de débit. */
export const tropDeRequetes = (resetDans: number) =>
  Response.json(
    { erreur: "Trop de requêtes. Réessayez dans un instant." },
    { status: 429, headers: { "Retry-After": String(Math.ceil(resetDans / 1000)) } }
  );

/** Borne la taille d'un corps de requête avant de le désérialiser. */
export async function corpsJsonBorne<T = unknown>(
  req: Request,
  maxOctets: number
): Promise<{ ok: true; donnees: T } | { ok: false; statut: 400 | 413; erreur: string }> {
  const annonce = Number(req.headers.get("content-length") ?? 0);
  if (annonce > maxOctets) {
    return { ok: false, statut: 413, erreur: `Corps trop volumineux (maximum ${Math.round(maxOctets / 1024)} Ko).` };
  }
  let texte: string;
  try {
    texte = await req.text();
  } catch {
    return { ok: false, statut: 400, erreur: "Corps de requête illisible" };
  }
  // `content-length` peut mentir ou être absent : on revérifie sur le réel.
  if (Buffer.byteLength(texte, "utf8") > maxOctets) {
    return { ok: false, statut: 413, erreur: `Corps trop volumineux (maximum ${Math.round(maxOctets / 1024)} Ko).` };
  }
  try {
    return { ok: true, donnees: JSON.parse(texte) as T };
  } catch {
    return { ok: false, statut: 400, erreur: "Corps de requête illisible" };
  }
}
