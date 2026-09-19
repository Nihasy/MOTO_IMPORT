"use client";

import Link from "next/link";
import clsx from "clsx";
import { useChromeVisible } from "@/components/ui/masquage-au-scroll";

/**
 * En-tete de la fiche produit.
 *
 * Composant client, et non quelques lignes dans la page : il partage le
 * masquage au defilement des autres barres. Sur une fiche, c'est la ou il sert
 * le plus — la galerie occupe le premier ecran, et rien ne doit la coiffer
 * pendant qu'on la parcourt.
 */
export function EnteteFiche({
  marque,
  modele,
  reference,
  className,
}: {
  marque: string;
  modele: string;
  reference: string;
  className?: string;
}) {
  const visible = useChromeVisible();
  return (
    <header
      className={clsx(
        "sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur",
        "transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
        !visible && "-translate-y-full",
        className
      )}
    >
      <div className="conteneur flex h-14 items-center gap-2">
        <Link
          href="/motos"
          className="flex h-touch w-touch items-center justify-center text-chrome"
          aria-label="Retour au catalogue"
        >
          ←
        </Link>
        <span className="flex-1 truncate text-[13px] font-medium">
          {marque} {modele}
        </span>
        <span className="text-meta text-dim">{reference}</span>
      </div>
    </header>
  );
}
