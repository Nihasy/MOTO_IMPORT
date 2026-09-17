"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import clsx from "clsx";
import type { Media } from "@/lib/types";
import { filigraneIncruste, urlMedia } from "@/lib/cloudinary";
import { Filigrane } from "@/components/ui/filigrane";

/**
 * Galerie au balayage d'une carte catalogue. Le balayage ne doit jamais
 * déclencher l'ouverture de la fiche (recette 16.1) : on absorbe le clic
 * dès qu'un déplacement horizontal a eu lieu.
 *
 * Chaque cliché porte la marque et refuse le menu contextuel : la carte de
 * catalogue est ce qui se copie le plus, parce qu'elle s'atteint sans ouvrir
 * la fiche.
 */
export function GalerieCarte({
  medias,
  alt,
  vues = 5,
  total,
}: {
  medias: Media[];
  alt: string;
  vues?: number;
  total?: number;
}) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const deplace = useRef(false);

  const affiches = medias.slice(0, vues);
  const nbTotal = total ?? medias.length;

  if (!affiches.length) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-hi text-dim">
        <span className="text-meta">Photos à venir</span>
      </div>
    );
  }

  const surDefilement = () => {
    const el = piste.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    if (i !== index) setIndex(Math.min(i, affiches.length - 1));
  };

  return (
    <div
      className="photo-protegee relative"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        depart.current = { x: e.clientX, y: e.clientY };
        deplace.current = false;
      }}
      onPointerMove={(e) => {
        if (!depart.current) return;
        if (Math.abs(e.clientX - depart.current.x) > 8) deplace.current = true;
      }}
      onClickCapture={(e) => {
        if (deplace.current) {
          e.preventDefault();
          e.stopPropagation();
          deplace.current = false;
        }
      }}
    >
      <div ref={piste} onScroll={surDefilement} className="defilement-x aspect-[4/3] w-full">
        {affiches.map((m, i) => (
          <div key={m.id} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface-hi">
            <Image
              src={urlMedia(m.cloudinary_id, "carte", { origine: m.origine })}
              alt={m.alt || alt}
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              className="object-cover"
              priority={i === 0}
              placeholder={m.blurhash ? "blur" : "empty"}
              blurDataURL={m.blurhash ?? undefined}
            />
            {m.origine === "reelle" && !filigraneIncruste(m.cloudinary_id, "carte", { origine: m.origine }) ? (
              <Filigrane />
            ) : null}
          </div>
        ))}
      </div>

      {affiches.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
          {affiches.map((m, i) => (
            <span
              key={m.id}
              className={clsx(
                "h-1 rounded-full transition-all",
                i === index ? "w-5 bg-gold-light" : "w-1.5 bg-white/45"
              )}
            />
          ))}
        </div>
      ) : null}

      <span className="pointer-events-none absolute bottom-2 right-2 rounded-card bg-black/65 px-2 py-1 text-badge font-semibold text-text backdrop-blur">
        {Math.min(index + 1, nbTotal)}/{nbTotal}
      </span>
    </div>
  );
}
