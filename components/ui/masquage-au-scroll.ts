"use client";

import { useSyncExternalStore } from "react";

/**
 * Masquage du chrome au defilement, a la maniere des applications mobiles :
 * on descend, l'en-tete et la barre du bas s'effacent pour laisser la photo
 * occuper l'ecran ; on remonte d'un geste, elles reviennent aussitot.
 *
 * Un seul ecouteur pour toute la page, partage par abonnement. Chaque barre
 * qui interrogerait la position de defilement pour son compte en installerait
 * un : quatre ecouteurs declenches a chaque pixel parcouru, la ou un seul
 * suffit, et sans garantie qu'ils basculent tous sur la meme image.
 */

/** Au-dessus de cette hauteur, le chrome reste toujours visible. */
const HAUT_DE_PAGE = 72;

/**
 * Course minimale avant de basculer. Sans elle, le tremblement du doigt pose
 * sur l'ecran suffit a faire clignoter les barres.
 */
const COURSE_MINIMALE = 8;

let visible = true;
let dernierY = 0;
let planifie = false;
const abonnes = new Set<() => void>();

/**
 * Un masquage au defilement est une animation declenchee par le geste : elle
 * est desactivee pour qui demande moins de mouvement. Les barres restent alors
 * simplement en place.
 */
const mouvementReduit = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function definir(v: boolean) {
  if (visible === v) return;
  visible = v;
  for (const notifier of abonnes) notifier();
}

export type Decision = { visible: boolean; repere: number };

/**
 * Coeur de la regle, isole de la fenetre pour etre verifiable : a partir de la
 * position courante, du repere precedent et de l'etat affiche, dit ce qu'il
 * faut afficher et ou replacer le repere.
 */
export function decider(y: number, repere: number, visible: boolean): Decision {
  const position = Math.max(0, y);

  // Pres du sommet, le chrome revient sans condition : c'est la que se trouvent
  // le logo et le retour, et une page courte ne doit jamais rester amputee.
  if (position <= HAUT_DE_PAGE) return { visible: true, repere: position };

  const course = position - repere;
  // En deca du seuil, rien ne bouge ET le repere ne se deplace pas : les petits
  // gestes s'additionnent jusqu'a former une intention.
  if (Math.abs(course) < COURSE_MINIMALE) return { visible, repere };

  return { visible: course < 0, repere: position };
}

function evaluer() {
  planifie = false;
  const d = decider(window.scrollY, dernierY, visible);
  dernierY = d.repere;
  definir(d.visible);
}

function auDefilement() {
  if (planifie) return;
  planifie = true;
  requestAnimationFrame(evaluer);
}

function abonner(notifier: () => void) {
  if (abonnes.size === 0 && !mouvementReduit()) {
    dernierY = Math.max(0, window.scrollY);
    window.addEventListener("scroll", auDefilement, { passive: true });
  }
  abonnes.add(notifier);
  return () => {
    abonnes.delete(notifier);
    if (abonnes.size === 0) window.removeEventListener("scroll", auDefilement);
  };
}

/** Le chrome doit-il etre affiche ? Rendu serveur : toujours oui. */
export function useChromeVisible(): boolean {
  return useSyncExternalStore(
    abonner,
    () => visible,
    () => true
  );
}

/**
 * A rappeler a chaque changement de page. Le defilement repart en haut mais
 * l'etat, lui, vit dans le module : sans remise a zero, on arriverait sur la
 * fiche suivante avec un en-tete deja escamote et aucun geste pour le rappeler.
 */
export function reinitialiserChrome() {
  dernierY = typeof window === "undefined" ? 0 : Math.max(0, window.scrollY);
  definir(true);
}
