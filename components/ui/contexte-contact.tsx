"use client";

import { createContext, useContext } from "react";
import { NUMERO_WHATSAPP } from "@/lib/whatsapp";

/**
 * Numéro WhatsApp en vigueur, lu en base par le gabarit public et transmis aux
 * composants client (cartes, barre d'action, catalogue). Hors de ce contexte,
 * le numéro de repli de l'environnement s'applique.
 *
 * Le porteur ne s'appelle pas « fournisseur », traduction pourtant naturelle
 * de *provider* : la recette et la recette de sécurité vérifient qu'aucune
 * page publique ne contient ce mot, garde-fou contre une fuite de données
 * fournisseur (12.2). Or React sérialise le nom des composants client dans la
 * charge RSC — le nom seul déclenchait les deux alarmes sur toutes les pages
 * publiques, et un garde-fou qui crie sans cesse ne garde plus rien.
 */
const Contexte = createContext<string>(NUMERO_WHATSAPP);

export function PorteurContact({ whatsapp, children }: { whatsapp: string; children: React.ReactNode }) {
  return <Contexte.Provider value={whatsapp}>{children}</Contexte.Provider>;
}

export function useWhatsapp(): string {
  return useContext(Contexte);
}
