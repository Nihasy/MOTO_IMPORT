"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/** Le back-office et ses écrans d'accès ne comptent pas comme audience. */
const PRIVEES = ["/admin", "/connexion"];

function filtrer(evenement: BeforeSendEvent): BeforeSendEvent | null {
  const chemin = new URL(evenement.url).pathname;
  return PRIVEES.some((p) => chemin === p || chemin.startsWith(`${p}/`)) ? null : evenement;
}

/**
 * Pages vues du site public, sans cookie (Vercel Web Analytics).
 *
 * Rebranchée le 10/10/2026, l'équipe Vercel étant passée au forfait Pro : les
 * événements au-delà de l'inclus coûtent 0,03 $ les 1 000 et s'imputent sur le
 * crédit mensuel, au lieu de mettre le site en pause comme sur le forfait
 * gratuit (30/09/2026). Les événements personnalisés restent limités à la
 * courte liste de `lib/analytics.ts`.
 */
export function MesureAudience() {
  return <Analytics beforeSend={filtrer} />;
}
