"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEnregistrees } from "@/components/catalogue/enregistrees";

export function BarreSuperieure({
  titre,
  filtresActifs = 0,
  onOuvrirFiltres,
  onOuvrirRecherche,
}: {
  titre?: string;
  filtresActifs?: number;
  onOuvrirFiltres?: () => void;
  onOuvrirRecherche?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="conteneur flex h-14 items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2" aria-label="MOTO IMPORT, accueil">
          <span className="text-[19px] font-extrabold tracking-wide text-gold-light">
            MOTO
          </span>
          <span className="text-[19px] font-extrabold tracking-wide text-chrome">
            IMPORT
          </span>
        </Link>
        {titre ? <span className="truncate text-[13px] text-dim">{titre}</span> : null}
        <div className="flex items-center gap-1">
          {onOuvrirRecherche ? (
            <button
              type="button"
              onClick={onOuvrirRecherche}
              aria-label="Rechercher"
              className="flex h-touch w-touch items-center justify-center rounded-full text-chrome hover:text-text"
            >
              <IconeLoupe />
            </button>
          ) : null}
          {onOuvrirFiltres ? (
            <button
              type="button"
              onClick={onOuvrirFiltres}
              aria-label={`Filtres${filtresActifs ? `, ${filtresActifs} actifs` : ""}`}
              className={clsx(
                "relative flex h-touch w-touch items-center justify-center rounded-full",
                filtresActifs ? "text-gold" : "text-chrome hover:text-text"
              )}
            >
              <IconeFiltres />
              {filtresActifs ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-on-gold">
                  {filtresActifs}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

const ENTREES = [
  { href: "/motos", libelle: "Catalogue", icone: IconeMaison },
  { href: "/enregistrees", libelle: "Enregistrées", icone: IconeSignet },
  { href: "/contact", libelle: "Contact", icone: IconeBulle },
  { href: "/plus", libelle: "Plus", icone: IconeMenu },
];

export function BarreInferieure() {
  const chemin = usePathname();
  const { ids } = useEnregistrees();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Navigation principale"
    >
      <ul className="conteneur flex items-stretch justify-between">
        {ENTREES.map(({ href, libelle, icone: Icone }) => {
          const actif = chemin === href || (href !== "/" && chemin.startsWith(href));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={clsx(
                  "relative flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-medium",
                  actif ? "text-gold-light" : "text-dim"
                )}
              >
                <Icone />
                {libelle}
                {href === "/enregistrees" && ids.length > 0 ? (
                  <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-on-gold">
                    {ids.length}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const svg = "h-5 w-5";

export function IconeLoupe() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconeFiltres() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function IconeMaison() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeSignet({ rempli = false }: { rempli?: boolean }) {
  return (
    <svg
      className={svg}
      viewBox="0 0 24 24"
      fill={rempli ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 4h12v17l-6-4.5L6 21z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconeBulle() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a8 8 0 1 1-3.2-6.4L21 4l-1.2 3.4A7.9 7.9 0 0 1 21 12z" strokeLinejoin="round" />
      <path d="M8.5 12h7M8.5 9h4" strokeLinecap="round" />
    </svg>
  );
}

function IconeMenu() {
  return (
    <svg className={svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
