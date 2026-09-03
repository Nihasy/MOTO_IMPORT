"use client";

import { useEffect } from "react";
import { pister } from "@/lib/analytics";

/** Incremente `vues` cote serveur et emet l'evenement analytics `vue_fiche`. */
export function CompteurVue({ id, reference }: { id: string; reference: string }) {
  useEffect(() => {
    pister("vue_fiche", { reference });
    const t = setTimeout(() => {
      void fetch(`/api/motos/${id}/vue`, { method: "POST", keepalive: true }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [id, reference]);
  return null;
}
