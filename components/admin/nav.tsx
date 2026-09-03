"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
 */
export function NavAdmin({ onglets }: { onglets: Onglet[] }) {
  const chemin = usePathname();

  return (
    <nav className="conteneur-large defilement-x gap-2 pb-2" aria-label="Sections du back-office">
      {onglets.map((o) => {
        // `/admin` ne doit s'activer que sur lui-même, sinon il resterait
        // allumé sur toutes les sous-routes.
        const actif = o.href === "/admin" ? chemin === "/admin" : chemin.startsWith(o.href);
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={actif ? "page" : undefined}
            className={clsx("puce shrink-0", actif && "puce-active")}
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
