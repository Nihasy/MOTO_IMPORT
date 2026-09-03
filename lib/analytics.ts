"use client";

import type { DemandeSource } from "./types";

type Evenement =
  | "vue_fiche"
  | "clic_devis"
  | "enregistrement"
  | "filtre_applique"
  | "galerie_balayee"
  | "plein_ecran_ouvert";

type Fenetre = Window & {
  fbq?: (...a: unknown[]) => void;
  ttq?: { track: (n: string, p?: unknown) => void };
  va?: (...a: unknown[]) => void;
};

export function pister(evenement: Evenement, donnees: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as Fenetre;
  try {
    w.va?.("event", { name: evenement, data: donnees });
    w.fbq?.("trackCustom", evenement, donnees);
    w.ttq?.track(evenement, donnees);
  } catch {
    /* la mesure ne doit jamais casser le parcours */
  }
}

const SOURCES: DemandeSource[] = [
  "facebook", "instagram", "tiktok", "google", "direct", "bouche_a_oreille",
];

/** Source captée depuis l'UTM, puis mémorisée pour la session. */
export function sourceVisiteur(): DemandeSource {
  if (typeof window === "undefined") return "direct";
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = (params.get("utm_source") ?? params.get("source") ?? "").toLowerCase();
    const trouvee = SOURCES.find((s) => utm.includes(s.replace(/_/g, "")) || utm === s);
    if (trouvee) {
      window.sessionStorage.setItem("mi_source", trouvee);
      return trouvee;
    }
    const memorisee = window.sessionStorage.getItem("mi_source");
    if (memorisee && (SOURCES as string[]).includes(memorisee)) return memorisee as DemandeSource;

    const ref = document.referrer.toLowerCase();
    if (ref.includes("facebook") || ref.includes("fb.")) return "facebook";
    if (ref.includes("instagram")) return "instagram";
    if (ref.includes("tiktok")) return "tiktok";
    if (ref.includes("google")) return "google";
  } catch {
    /* ignore */
  }
  return "direct";
}

/**
 * Enregistre la demande AVANT la redirection WhatsApp (9.3).
 * `keepalive` garantit l'envoi même si l'onglet part vers WhatsApp.
 */
export async function enregistrerDemande(charge: {
  moto_id?: string | null;
  reference?: string | null;
  budget_max?: number | null;
  message?: string | null;
}): Promise<void> {
  try {
    await fetch("/api/demandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...charge, source: sourceVisiteur() }),
      keepalive: true,
    });
  } catch {
    /* une demande perdue ne doit pas bloquer l'ouverture de WhatsApp */
  }
}
