"use client";

import { createContext, useContext } from "react";
import { NUMERO_WHATSAPP } from "@/lib/whatsapp";

/**
 * Numéro WhatsApp en vigueur, lu en base par le gabarit public et transmis aux
 * composants client (cartes, barre d'action, catalogue). Hors de ce contexte,
 * le numéro de repli de l'environnement s'applique.
 */
const Contexte = createContext<string>(NUMERO_WHATSAPP);

export function FournisseurContact({ whatsapp, children }: { whatsapp: string; children: React.ReactNode }) {
  return <Contexte.Provider value={whatsapp}>{children}</Contexte.Provider>;
}

export function useWhatsapp(): string {
  return useContext(Contexte);
}
