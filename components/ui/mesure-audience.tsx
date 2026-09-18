"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/** Le back-office et ses écrans d'accès ne comptent pas comme audience. */
const PRIVEES = ["/admin", "/connexion"];

function filtrer(evenement: BeforeSendEvent): BeforeSendEvent | null {
  const chemin = new URL(evenement.url).pathname;
  return PRIVEES.some((p) => chemin === p || chemin.startsWith(`${p}/`)) ? null : evenement;
}

export function MesureAudience() {
  return <Analytics beforeSend={filtrer} />;
}
