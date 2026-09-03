"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { estNouvelle } from "@/lib/format";

/**
 * Bandeau « Nouveau », visible vingt-quatre heures après la mise en ligne.
 *
 * Le calcul se fait après montage, jamais au rendu serveur : la fiche produit
 * est mise en cache une heure, un badge calculé côté serveur resterait affiché
 * jusqu'à soixante minutes de trop — ou manquerait à l'appel. Rendu côté
 * client, il tombe à la seconde près et évite l'écart d'hydratation entre
 * l'horloge du serveur et celle du visiteur.
 */
export function BadgeNouveau({ creeLe, className }: { creeLe: string; className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!estNouvelle(creeLe)) return;
    setVisible(true);
    // La fiche peut rester ouverte a cheval sur l'echeance : on retire le
    // bandeau au moment exact ou il expire, sans attendre un rechargement.
    const reste = new Date(creeLe).getTime() + 24 * 60 * 60 * 1000 - Date.now();
    const t = setTimeout(() => setVisible(false), Math.max(reste, 0));
    return () => clearTimeout(t);
  }, [creeLe]);

  if (!visible) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center border-l-[3px] border-l-gold bg-bg px-2 py-1 text-badge font-bold uppercase leading-none text-gold-light",
        className
      )}
    >
      Nouveau
    </span>
  );
}
