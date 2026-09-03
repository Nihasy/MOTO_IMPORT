"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { TRIS, type Ordre } from "@/lib/db/filtres";

/**
 * Selecteur de tri : critere et sens dans un seul panneau.
 *
 * Un `<select>` natif rendait mal sur fond sombre — le systeme impose sa
 * propre liste, blanche sur iOS, et le sens de tri vivait a cote sans lien
 * visible. Ici les deux reglages tiennent ensemble, dans la meme langue
 * graphique que la feuille de filtres.
 */
export function SelecteurTri({
  tri,
  ordre,
  onChanger,
}: {
  tri: string;
  ordre: Ordre;
  onChanger: (maj: { tri?: string; ordre?: Ordre }) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("mousedown", auClic);
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("mousedown", auClic);
      document.removeEventListener("keydown", auClavier);
    };
  }, [ouvert]);

  return (
    <div ref={boite} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-haspopup="true"
        className={clsx(
          "flex min-h-[40px] items-center gap-2 border bg-surface-hi px-3.5 text-[14px] font-semibold transition-colors",
          ouvert ? "border-gold text-text" : "border-line text-chrome hover:border-gold/60 hover:text-text"
        )}
      >
        <span className="text-dim">Trier par</span>
        <span className="text-gold-light">{TRIS[tri] ?? TRIS.date}</span>
        <span aria-hidden className="text-gold-light">
          {ordre === "asc" ? "↑" : "↓"}
        </span>
        <Chevron ouvert={ouvert} />
      </button>

      {ouvert ? (
        <div
          className={clsx(
            "absolute z-40 mt-1 w-56 border border-line bg-surface shadow-xl shadow-black/50",
            // Centre sous le bouton sur mobile, aligne a droite des la rangee.
            "left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0"
          )}
        >
          <ul role="listbox" aria-label="Critère de tri">
            {Object.entries(TRIS).map(([cle, libelle]) => {
              const actif = cle === tri;
              return (
                <li key={cle}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={actif}
                    onClick={() => {
                      onChanger({ tri: cle });
                      setOuvert(false);
                    }}
                    className={clsx(
                      "flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[14px] transition-colors",
                      actif
                        ? "bg-surface-hi font-semibold text-gold-light"
                        : "text-chrome hover:bg-surface-hi hover:text-text"
                    )}
                  >
                    {libelle}
                    {actif ? <Coche /> : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-line p-2">
            <div role="group" aria-label="Sens du tri" className="grid grid-cols-2 gap-1">
              {(
                [
                  ["desc", "Décroissant", "↓"],
                  ["asc", "Croissant", "↑"],
                ] as const
              ).map(([cle, libelle, fleche]) => (
                <button
                  type="button"
                  key={cle}
                  onClick={() => onChanger({ ordre: cle })}
                  aria-pressed={ordre === cle}
                  className={clsx(
                    "flex min-h-[36px] items-center justify-center gap-1.5 border text-[13px] font-semibold transition-colors",
                    ordre === cle
                      ? "border-gold bg-gold text-on-gold"
                      : "border-line bg-surface-hi text-chrome hover:text-text"
                  )}
                >
                  <span aria-hidden>{fleche}</span>
                  {libelle}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("shrink-0 text-dim transition-transform", ouvert && "rotate-180")}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Coche() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
