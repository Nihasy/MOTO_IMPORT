import { ar } from "./format";
import type { MotoPublique } from "./types";

export const NUMERO_WHATSAPP =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") || "261340000000";

const lien = (texte: string) =>
  `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(texte)}`;

/** Message de devis pour une moto encore proposee. */
export function messageDevis(m: Pick<MotoPublique, "marque" | "modele" | "annee" | "reference" | "prix_ttc">): string {
  return `Bonjour MOTO IMPORT, je suis interesse par la ${m.marque} ${m.modele} ${m.annee} (ref. ${m.reference}) a ${ar(m.prix_ttc)}.`;
}

/** Message adapte a une moto vendue : la fiche continue de generer des demandes. */
export function messageMemeModele(m: Pick<MotoPublique, "marque" | "modele" | "annee" | "reference">): string {
  return `Bonjour MOTO IMPORT, la ${m.marque} ${m.modele} ${m.annee} (ref. ${m.reference}) est vendue. Pouvez-vous me trouver la meme ou un modele equivalent ?`;
}

export function lienDevis(m: MotoPublique): string {
  return lien(m.statut === "vendu" ? messageMemeModele(m) : messageDevis(m));
}

export function lienRecherche(budget?: number): string {
  const base = "Bonjour MOTO IMPORT, je cherche une moto";
  return lien(budget ? `${base} avec un budget d'environ ${ar(budget)}.` : `${base}. Pouvez-vous me conseiller ?`);
}

export function lienLibre(texte: string): string {
  return lien(texte);
}

export function lienConversation(telephone: string, texte: string): string {
  const num = telephone.replace(/[^\d]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(texte)}`;
}
