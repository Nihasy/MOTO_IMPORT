import "server-only";
import { db } from "./db";
import { carteCouverture, carteMoto } from "./carte-facebook";
import { estEnVente } from "./types";
import { nomCarte, type Album, type LigneStudio } from "./facebook";

/** Lignes du Studio, tirées de la liste d'administration (couverture comprise). */
export async function lignesStudio(): Promise<LigneStudio[]> {
  const motos = await db().listerMotosAdmin();
  return motos.map((m) => ({
    id: m.id,
    reference: m.reference,
    slug: m.slug,
    marque: m.marque,
    modele: m.modele,
    annee: m.annee,
    cylindree: m.cylindree,
    categorie: m.categorie,
    etat: m.etat,
    statut: m.statut,
    kilometrage: m.kilometrage,
    prix_ttc: m.prix_ttc,
    created_at: m.created_at,
    mise_en_vente: m.mise_en_vente,
    couverture: m.couverture,
  }));
}

/**
 * Motos d'un album, dans l'ordre choisi. Refuse une référence inconnue ou une
 * moto qui n'est plus en vente : entre l'ouverture du Studio et l'envoi, une
 * fiche a pu être vendue ou repassée en brouillon, et son lien mènerait nulle part.
 */
export async function motosDeLAlbum(refs: string[]): Promise<LigneStudio[]> {
  const parRef = new Map((await lignesStudio()).map((m) => [m.reference, m]));
  return refs.map((ref) => {
    const m = parRef.get(ref);
    if (!m) throw new Error(`${ref} introuvable.`);
    if (!estEnVente(m.statut)) throw new Error(`${ref} n'est plus en vente.`);
    if (!m.couverture) throw new Error(`${ref} n'a pas de photo.`);
    return m;
  });
}

export type CarteRendue = { nom: string; png: ArrayBuffer; legende: string };

/**
 * PNG de l'album, couverture en tête si demandée. Fabriqués l'un après l'autre :
 * chaque carte télécharge sa photo chez Cloudinary, et dix rendus simultanés
 * font monter la mémoire de la fonction sans rien faire gagner à l'écran.
 */
export async function rendreAlbum(album: Album, origine: string): Promise<CarteRendue[]> {
  const motos = await motosDeLAlbum(album.motos.map((m) => m.ref));
  const cartes: CarteRendue[] = [];
  if (album.couverture) {
    cartes.push({
      nom: nomCarte(0, "couverture"),
      png: await carteCouverture(album.titre || "Motos du catalogue", motos, origine).arrayBuffer(),
      legende: album.titre,
    });
  }
  for (const [i, m] of motos.entries()) {
    cartes.push({
      nom: nomCarte(i + 1, m.reference),
      png: await carteMoto(m, origine).arrayBuffer(),
      legende: album.motos[i].legende,
    });
  }
  return cartes;
}

/** Origine de la requête, pour les photos servies par le site lui-même. */
export function origineDe(entetes: Headers): string {
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host") ?? "localhost:3000";
  const proto = entetes.get("x-forwarded-proto") ?? (hote.startsWith("localhost") ? "http" : "https");
  return `${proto}://${hote}`;
}
