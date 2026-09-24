"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export type Onglet = { href: string; libelle: string; compte?: number; ton?: "alerte" | "action" };

/**
 * Navigation du back-office.
 *
 * Deux manques corrigés ici. L'onglet courant n'était pas signalé : on ne
 * savait pas où l'on se trouvait, ce qui compte d'autant plus que les cinq
 * écrans se ressemblent. Et rien ne remontait ce qui attend une action — les
 * pastilles évitent d'avoir à ouvrir chaque écran pour découvrir qu'il n'y a
 * rien à y faire.
 *
 * Sur téléphone, la bande fait plus du double de l'écran : sans recentrage,
 * l'onglet actif des dernières sections (Paramètres, Tarification) restait
 * hors champ, et avec lui la réponse à « où suis-je ». Le fondu au bord dit
 * qu'il reste des onglets à balayer. La bande reste en haut plutôt qu'en bas :
 * les formulaires occupent déjà le bas de l'écran avec leur barre
 * d'enregistrement collante.
 */
export function NavAdmin({ onglets }: { onglets: Onglet[] }) {
  const chemin = usePathname();
  const bande = useRef<HTMLElement>(null);
  const [bords, setBords] = useState({ gauche: false, droite: false });

  function mesurer() {
    const n = bande.current;
    if (!n) return;
    setBords({
      gauche: n.scrollLeft > 4,
      droite: n.scrollLeft + n.clientWidth < n.scrollWidth - 4,
    });
  }

  useEffect(() => {
    const n = bande.current;
    const actif = n?.querySelector<HTMLElement>('[aria-current="page"]');
    // `scrollLeft` plutôt que `scrollIntoView` : ce dernier ferait aussi
    // défiler la page verticalement vers l'en-tête.
    if (n && actif) {
      n.scrollLeft = actif.offsetLeft - (n.clientWidth - actif.offsetWidth) / 2;
    }
    mesurer();
  }, [chemin]);

  useEffect(() => {
    window.addEventListener("resize", mesurer);
    return () => window.removeEventListener("resize", mesurer);
  }, []);

  const masque =
    bords.gauche && bords.droite
      ? "linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent)"
      : bords.droite
        ? "linear-gradient(to right, #000 calc(100% - 28px), transparent)"
        : bords.gauche
          ? "linear-gradient(to right, transparent, #000 28px)"
          : undefined;

  return (
    <nav
      ref={bande}
      onScroll={mesurer}
      style={{ maskImage: masque, WebkitMaskImage: masque }}
      className="conteneur-large flex gap-2 overflow-x-auto pb-2 no-scrollbar"
      aria-label="Sections du back-office"
    >
      {onglets.map((o) => {
        // `/admin` ne doit s'activer que sur lui-même, sinon il resterait
        // allumé sur toutes les sous-routes.
        const actif = o.href === "/admin" ? chemin === "/admin" : chemin.startsWith(o.href);
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={actif ? "page" : undefined}
            className={clsx("puce shrink-0 whitespace-nowrap", actif && "puce-active")}
          >
            {o.libelle}
            {o.compte ? (
              <span
                className={clsx(
                  "ml-1.5 inline-flex min-w-[18px] justify-center rounded-full px-1.5 text-[10.5px] font-bold leading-[16px]",
                  actif
                    ? "bg-on-gold/15 text-on-gold"
                    : o.ton === "alerte"
                      ? "bg-vendu text-white"
                      : "bg-gold text-on-gold"
                )}
              >
                {o.compte}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
