import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { enProduction, secretSession } from "./config";

export type Role = "admin" | "editeur";
export type Session = { email: string; role: Role };

const COOKIE = "mi_session";
const DUREE = 60 * 60 * 12;

/**
 * Comptes back-office : deux cofondateurs (1.4).
 *
 * En production, `ADMIN_ACCOUNTS` est obligatoire. Sans elle la liste est
 * vide et personne ne peut se connecter : des identifiants écrits dans le
 * code source ouvriraient le back-office à quiconque lit le dépôt.
 */
export function comptes(): { email: string; motDePasse: string; role: Role }[] {
  const brut = process.env.ADMIN_ACCOUNTS;
  if (brut) {
    return brut
      .split(";")
      .map((c) => c.split(":"))
      .filter((p) => p.length >= 2 && p[0].trim() && p[1])
      .map(([email, motDePasse, role]) => ({
        email: email.trim().toLowerCase(),
        motDePasse,
        role: (role?.trim() === "editeur" ? "editeur" : "admin") as Role,
      }));
  }
  if (enProduction()) return [];
  return [
    { email: "nihasy@moto-import.mg", motDePasse: "moto-import-2026", role: "admin" },
    { email: "editrice@moto-import.mg", motDePasse: "moto-import-2026", role: "editeur" },
  ];
}

export function signer(donnees: Session): string {
  const charge = Buffer.from(
    JSON.stringify({ ...donnees, exp: Math.floor(Date.now() / 1000) + DUREE })
  ).toString("base64url");
  const sig = createHmac("sha256", secretSession()).update(charge).digest("base64url");
  return `${charge}.${sig}`;
}

export function verifier(jeton: string | undefined): Session | null {
  if (!jeton) return null;
  const [charge, sig] = jeton.split(".");
  if (!charge || !sig) return null;

  let attendu: string;
  try {
    attendu = createHmac("sha256", secretSession()).update(charge).digest("base64url");
  } catch {
    // Configuration incomplète en production : aucune session n'est valide.
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const d = JSON.parse(Buffer.from(charge, "base64url").toString()) as Partial<Session> & {
      exp?: number;
    };
    if (typeof d.exp !== "number" || d.exp * 1000 < Date.now()) return null;
    if (d.role !== "admin" && d.role !== "editeur") return null;
    if (typeof d.email !== "string" || !d.email) return null;
    return { email: d.email, role: d.role };
  } catch {
    return null;
  }
}

/** Comparaison à durée constante, pour ne pas fuiter le mot de passe par le temps de réponse. */
function egaliteConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // On compare tout de même, pour que la durée ne dépende pas de la longueur.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function authentifier(email: string, motDePasse: string): Session | null {
  const cible = email.trim().toLowerCase();
  let trouve: Session | null = null;
  // Parcours complet et systématique : ni court-circuit sur le compte trouvé,
  // ni différence de traitement entre « compte inconnu » et « mot de passe faux ».
  for (const c of comptes()) {
    const memeEmail = egaliteConstante(c.email, cible);
    const memeMotDePasse = egaliteConstante(c.motDePasse, motDePasse);
    if (memeEmail && memeMotDePasse) trouve = { email: c.email, role: c.role };
  }
  return trouve;
}

/**
 * Destination de redirection après connexion.
 * Seul un chemin interne du back-office est accepté : tout le reste retombe
 * sur /admin, ce qui ferme la redirection ouverte.
 */
export function destinationSure(suite: unknown): string {
  if (typeof suite !== "string") return "/admin";
  if (!/^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/.test(suite)) return "/admin";
  if (suite.includes("//") || suite.includes("..") || suite.includes("\\")) return "/admin";
  return suite;
}

export async function sessionCourante(): Promise<Session | null> {
  const jar = await cookies();
  return verifier(jar.get(COOKIE)?.value);
}

export async function ouvrirSession(s: Session) {
  const jar = await cookies();
  jar.set(COOKIE, signer(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: enProduction(),
    path: "/",
    maxAge: DUREE,
  });
}

export async function fermerSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export const NOM_COOKIE = COOKIE;
