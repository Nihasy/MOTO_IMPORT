"use client";

import { useSyncExternalStore } from "react";

/**
 * Un seul état partagé « une navigation est en cours », sur le modèle de
 * `masquage-au-scroll` : l'indicateur s'y abonne, et n'importe quel code peut
 * le lever.
 *
 * Les clics sur les liens et les retours arrière sont captés par l'indicateur
 * lui-même. Les navigations lancées depuis le code — les filtres du catalogue
 * appellent `router.push` — n'émettent aucun événement observable : elles
 * préviennent ici, sinon la page attendrait sans rien dire.
 */

let enCours = false;
const abonnes = new Set<() => void>();

function notifier() {
  for (const a of abonnes) a();
}

export function demarrerNavigation() {
  if (enCours) return;
  enCours = true;
  notifier();
}

export function terminerNavigation() {
  if (!enCours) return;
  enCours = false;
  notifier();
}

function sAbonner(ecouteur: () => void) {
  abonnes.add(ecouteur);
  return () => {
    abonnes.delete(ecouteur);
  };
}

export function useNavigationEnCours() {
  // Le serveur ne navigue pas : au rendu initial, toujours au repos.
  return useSyncExternalStore(sAbonner, () => enCours, () => false);
}
