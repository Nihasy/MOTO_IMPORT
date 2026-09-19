import { ar } from "./format";
import { montantAcompte } from "./conditions";
import type { MotoPublique } from "./types";

/**
 * Numéro de repli. Le numéro en vigueur se règle dans le back-office
 * (Paramètres) : les pages le reçoivent de `parametres()` côté serveur, ou de
 * `useWhatsapp()` côté client, et le passent en dernier argument.
 */
export const NUMERO_WHATSAPP =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") || "261340000000";

const lien = (texte: string, numero: string = NUMERO_WHATSAPP) =>
  `https://wa.me/${numero.replace(/[^\d]/g, "") || NUMERO_WHATSAPP}?text=${encodeURIComponent(texte)}`;

/** Message de devis pour une moto encore proposee. */
export function messageDevis(
  m: Pick<MotoPublique, "marque" | "modele" | "annee" | "reference" | "prix_ttc"> &
    Partial<Pick<MotoPublique, "acompte_pct" | "statut">>
): string {
  const base = `Bonjour MOTO IMPORT, je suis interesse par la ${m.marque} ${m.modele} ${m.annee} (ref. ${m.reference}) a ${ar(m.prix_ttc)}`;
  // L'acompte affiché sur la fiche est repris : la conversation part des mêmes
  // chiffres que ceux que le client a lus (CGV art. 4.2).
  return m.acompte_pct && m.statut === "disponible"
    ? `${base}, acompte de ${m.acompte_pct} % (${ar(montantAcompte(m.prix_ttc, m.acompte_pct))}).`
    : `${base}.`;
}

/** Message adapte a une moto vendue : la fiche continue de generer des demandes. */
export function messageMemeModele(m: Pick<MotoPublique, "marque" | "modele" | "annee" | "reference">): string {
  return `Bonjour MOTO IMPORT, la ${m.marque} ${m.modele} ${m.annee} (ref. ${m.reference}) est vendue. Pouvez-vous me trouver la meme ou un modele equivalent ?`;
}

export function lienDevis(m: MotoPublique, numero?: string): string {
  return lien(m.statut === "vendu" ? messageMemeModele(m) : messageDevis(m), numero);
}

export function lienRecherche(budget?: number, numero?: string): string {
  const base = "Bonjour MOTO IMPORT, je cherche une moto";
  return lien(
    budget ? `${base} avec un budget d'environ ${ar(budget)}.` : `${base}. Pouvez-vous me conseiller ?`,
    numero
  );
}

export function lienLibre(texte: string, numero?: string): string {
  return lien(texte, numero);
}

export function lienConversation(telephone: string, texte: string): string {
  const num = telephone.replace(/[^\d]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(texte)}`;
}
