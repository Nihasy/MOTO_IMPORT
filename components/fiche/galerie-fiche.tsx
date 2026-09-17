"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Media } from "@/lib/types";
import { filigraneIncruste, urlMedia } from "@/lib/cloudinary";
import { Filigrane } from "@/components/ui/filigrane";
import { pister } from "@/lib/analytics";

export function GalerieFiche({ medias, alt }: { medias: Media[]; alt: string }) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [plein, setPlein] = useState(false);

  useEffect(() => {
    if (!plein) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlein(false);
      if (e.key === "ArrowRight") allerA(Math.min(index + 1, medias.length - 1));
      if (e.key === "ArrowLeft") allerA(Math.max(index - 1, 0));
    };
    document.addEventListener("keydown", surTouche);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plein, index, medias.length]);

  if (!medias.length) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-hi text-dim">
        Photos à venir
      </div>
    );
  }

  const courant = medias[Math.min(index, medias.length - 1)];

  const allerA = (i: number) => {
    const el = piste.current;
    setIndex(i);
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <>
      <div className="photo-protegee relative bg-surface-hi" onContextMenu={(e) => e.preventDefault()}>
        <div
          ref={piste}
          className="defilement-x aspect-[4/3] w-full"
          onScroll={() => {
            const el = piste.current;
            if (!el) return;
            const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
            if (i !== index) {
              setIndex(Math.min(i, medias.length - 1));
              pister("galerie_balayee", { index: i });
            }
          }}
        >
          {medias.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setIndex(i);
                setPlein(true);
                pister("plein_ecran_ouvert", { index: i });
              }}
              className="relative aspect-[4/3] w-full shrink-0 snap-center"
              aria-label={`Ouvrir en plein écran : ${m.alt}`}
            >
              <Image
                src={urlMedia(m.cloudinary_id, "galerie", { origine: m.origine })}
                alt={m.alt || alt}
                fill
                sizes="(max-width: 672px) 100vw, 672px"
                className="object-cover"
                priority={i === 0}
                placeholder={m.blurhash ? "blur" : "empty"}
                blurDataURL={m.blurhash ?? undefined}
              />
              {m.vue === "defaut" ? (
                <span className="absolute left-2 top-2 rounded-card bg-vendu px-2.5 py-1 text-badge font-semibold uppercase tracking-wide text-white">
                  Point d&apos;usure
                </span>
              ) : null}
              {m.origine === "constructeur" ? (
                <span className="absolute right-2 top-2 rounded-card bg-black/70 px-2.5 py-1 text-badge font-semibold uppercase tracking-wide text-chrome backdrop-blur">
                  Visuel constructeur
                </span>
              ) : null}
              {m.origine === "reelle" && !filigraneIncruste(m.cloudinary_id, "galerie", { origine: m.origine }) ? (
                <Filigrane />
              ) : null}
            </button>
          ))}
        </div>

        <span className="pointer-events-none absolute bottom-2 right-2 rounded-card bg-black/70 px-2.5 py-1 text-badge font-semibold text-text backdrop-blur">
          {index + 1}/{medias.length}
        </span>
      </div>

      <div className="defilement-x gap-2 px-4 pb-2">
        {medias.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => allerA(i)}
            aria-label={`Voir la photo ${i + 1}`}
            aria-current={i === index}
            className={clsx(
              "relative aspect-[4/3] h-14 shrink-0 overflow-hidden rounded border-2 transition-colors",
              i === index ? "border-gold" : m.vue === "defaut" ? "border-vendu/70" : "border-line"
            )}
          >
            <Image
              src={urlMedia(m.cloudinary_id, "vignette", { origine: m.origine })}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {plein ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Galerie plein écran">
          <div className="flex items-center justify-between px-4 py-3 text-text">
            <span className="text-meta">
              {index + 1} / {medias.length}
            </span>
            <button type="button" onClick={() => setPlein(false)} className="min-h-touch px-3 text-[13px] font-semibold" aria-label="Fermer le plein écran">
              Fermer
            </button>
          </div>
          {/* La photo dicte la taille de son cadre plutôt que l'inverse : sur un
              écran portrait, un `object-contain` plein cadre laisse deux bandes
              noires, et la marque posée sur le cadre flotterait à côté de
              l'image au lieu d'être dessus — donc hors de la capture recadrée. */}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <span
              className="photo-protegee relative inline-flex max-h-full"
              onContextMenu={(e) => e.preventDefault()}
            >
              <Image
                src={urlMedia(courant.cloudinary_id, "plein", { origine: courant.origine })}
                alt={courant.alt || alt}
                width={courant.largeur || 1600}
                height={courant.hauteur || 1200}
                sizes="100vw"
                className="object-contain"
                style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
              />
              {courant.origine === "reelle" &&
              !filigraneIncruste(courant.cloudinary_id, "plein", { origine: courant.origine }) ? (
                <Filigrane />
              ) : null}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
            <button type="button" className="btn-fantome flex-1" onClick={() => allerA(Math.max(index - 1, 0))} disabled={index === 0}>
              Précédente
            </button>
            <button
              type="button"
              className="btn-fantome flex-1"
              onClick={() => allerA(Math.min(index + 1, medias.length - 1))}
              disabled={index === medias.length - 1}
            >
              Suivante
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
