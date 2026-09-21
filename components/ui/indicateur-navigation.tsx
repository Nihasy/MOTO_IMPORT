"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { VoileChargement } from "./chargement-moto";
import {
  demarrerNavigation,
  terminerNavigation,
  useNavigationEnCours,
} from "./navigation-en-cours";

/**
 * Retour d'attente pour toutes les navigations : clic sur un lien, retour et
 * suivante du navigateur, filtres du catalogue.
 *
 * Deux temps, comme sur les grands sites : une barre file en haut de l'écran
 * dès le clic — elle suffit à dire « c'est parti » —, et la moto ne vient
 * couvrir la page que si l'attente se prolonge. Sans ce délai, un aller-retour
 * servi depuis le cache du routeur ferait clignoter un voile plein écran pour
 * quarante millisecondes, ce qui est plus agressif que pas d'indicateur du
 * tout.
 *
 * La barre s'approche du bord sans jamais l'atteindre : sa durée réelle est
 * inconnue, et une barre qui touche le bout puis attend ment au visiteur.
 * Elle ne se referme qu'une fois la page arrivée.
 */

/** Attente à partir de laquelle la moto rejoint la barre. */
const SEUIL_VOILE = 450;

/** Filet de sécurité : au-delà, on rend la main même sans signal d'arrivée. */
const ABANDON = 10_000;

/** Durée du repli de la barre une fois la page arrivée. */
const REPLI = 300;

export function IndicateurNavigation() {
  const enCours = useNavigationEnCours();
  const chemin = usePathname();
  const parametres = useSearchParams();
  const [etat, setEtat] = useState<"repos" | "encours" | "fin">("repos");
  const [voile, setVoile] = useState(false);

  /* La page demandée est arrivée : chemin ou paramètres d'URL ont changé.
     C'est le seul signal fiable de fin — le routeur ne prévient pas. */
  useEffect(() => {
    terminerNavigation();
  }, [chemin, parametres]);

  /* Retour depuis le cache arrière du navigateur : la page est déjà là, il n'y
     a rien à attendre. */
  useEffect(() => {
    const surRestauration = () => terminerNavigation();
    window.addEventListener("pageshow", surRestauration);
    return () => window.removeEventListener("pageshow", surRestauration);
  }, []);

  /* Départ : un clic sur un lien interne, ou les boutons précédent/suivant. */
  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      // Clic droit, clic molette, ou modificateur : la page courante reste.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const lien = (e.target as Element | null)?.closest?.("a");
      if (!(lien instanceof HTMLAnchorElement)) return;
      if (lien.target && lien.target !== "_self") return;
      if (lien.hasAttribute("download")) return;

      const href = lien.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let cible: URL;
      try {
        cible = new URL(lien.href);
      } catch {
        return;
      }
      // Autre site, téléphone, courriel : le navigateur quitte la page ou
      // ouvre une application, notre indicateur n'a rien à y faire.
      if (cible.origin !== window.location.origin) return;
      // Même adresse exactement : le routeur ne navigue pas.
      if (cible.href === window.location.href) return;

      demarrerNavigation();
    };

    const surHistorique = () => demarrerNavigation();

    // En phase de capture : un `stopPropagation` posé par un composant ne doit
    // pas nous priver du signal.
    document.addEventListener("click", surClic, { capture: true });
    window.addEventListener("popstate", surHistorique);
    return () => {
      document.removeEventListener("click", surClic, { capture: true });
      window.removeEventListener("popstate", surHistorique);
    };
  }, []);

  /* Départ : la barre part aussitôt, la moto attend le seuil. */
  useEffect(() => {
    if (!enCours) return;
    setEtat("encours");
    const versVoile = setTimeout(() => setVoile(true), SEUIL_VOILE);
    const abandon = setTimeout(() => terminerNavigation(), ABANDON);
    return () => {
      clearTimeout(versVoile);
      clearTimeout(abandon);
    };
  }, [enCours]);

  /* Arrivée : la moto se retire, la barre va au bout puis s'efface. */
  useEffect(() => {
    if (enCours) return;
    setVoile(false);
    if (etat !== "encours") return;
    setEtat("fin");
    const repli = setTimeout(() => setEtat("repos"), REPLI);
    return () => clearTimeout(repli);
  }, [enCours, etat]);

  if (etat === "repos") return null;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[56] h-[3px] bg-transparent"
      >
        <div
          className={clsx(
            "h-full origin-left bg-gold shadow-[0_0_8px_rgba(192,138,46,0.6)]",
            etat === "encours"
              ? "animate-progression"
              : "scale-x-100 opacity-0 transition-opacity duration-300"
          )}
        />
      </div>
      {voile ? <VoileChargement texte="Chargement" /> : null}
    </>
  );
}
