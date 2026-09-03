"use client";

import { useCallback, useEffect, useState } from "react";

const CLE = "mi_enregistrees";
const EVENEMENT = "mi:enregistrees";

function lire(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(CLE);
    const v = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function ecrire(ids: string[]) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(ids));
  } catch {
    /* mode privé : la sélection reste en mémoire pour la session */
  }
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: ids }));
}

/** Sélection locale, propre au navigateur du visiteur. */
export function useEnregistrees() {
  const [ids, setIds] = useState<string[]>([]);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    setIds(lire());
    setPret(true);
    const maj = () => setIds(lire());
    window.addEventListener(EVENEMENT, maj);
    window.addEventListener("storage", maj);
    return () => {
      window.removeEventListener(EVENEMENT, maj);
      window.removeEventListener("storage", maj);
    };
  }, []);

  const basculer = useCallback((id: string) => {
    const actuels = lire();
    ecrire(actuels.includes(id) ? actuels.filter((x) => x !== id) : [...actuels, id]);
  }, []);

  const contient = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, pret, basculer, contient };
}
