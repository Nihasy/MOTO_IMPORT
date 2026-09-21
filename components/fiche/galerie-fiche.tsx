"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Media } from "@/lib/types";
import { filigraneIncruste, servieParCloudinary, urlMedia } from "@/lib/cloudinary";
import { Filigrane } from "@/components/ui/filigrane";
import { ChargementMoto } from "@/components/ui/chargement-moto";
import { pister } from "@/lib/analytics";

export function GalerieFiche({ medias, alt }: { medias: Media[]; alt: string }) {
  const piste = useRef<HTMLDivElement>(null);
  const pistePlein = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [plein, setPlein] = useState(false);
  /* Une photo déjà affichée une fois reste marquée comme chargée : en revenant
     dessus elle sort du cache du navigateur, et refaire clignoter le voile de
     chargement donnerait l'impression d'une attente qui n'existe pas. */
  const [chargees, setChargees] = useState<Record<string, true>>({});
  /* La vignette de la piste et la photo plein écran sont deux fichiers
     distincts du même média : les compter séparément, sinon le plein écran se
     croirait prêt parce que sa miniature l'est. */
  const cle = (m: Media, taille: "galerie" | "plein") => `${m.id}:${taille}`;

  /* Ouverture du plein écran : la piste doit être posée SUR la photo touchée,
     et d'un coup. Un `scrollTo` animé partirait de la première photo et
     ferait défiler tout l'album sous les yeux avant d'arriver. La mesure est
     prise après la peinture, quand la piste a enfin une largeur. */
  useEffect(() => {
    if (!plein) return;
    const el = pistePlein.current;
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plein]);

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

  /* Les boutons, les vignettes et les flèches du clavier passent par la même
     porte que le doigt : ils font défiler la piste au lieu de changer l'image.
     Le compteur, lui, est mis à jour par le défilement, quelle que soit son
     origine — il ne peut donc pas mentir sur ce qui est à l'écran. */
  const allerA = (i: number) => {
    const el = plein ? pistePlein.current : piste.current;
    setIndex(i);
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  /** Indice de la photo sous les yeux, déduit de la position de la piste. */
  const indiceDefile = (el: HTMLDivElement) =>
    Math.min(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)), medias.length - 1);

  const surDefilementPlein = () => {
    const el = pistePlein.current;
    if (!el) return;
    const i = indiceDefile(el);
    if (i === index) return;
    setIndex(i);
    pister("galerie_balayee", { index: i });
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
            const i = indiceDefile(el);
            if (i === index) return;
            setIndex(i);
            pister("galerie_balayee", { index: i });
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
              {/* Sans blurhash, il n'y a rien à montrer avant l'arrivée du
                  fichier : une plaque qui pulse vaut mieux qu'un trou. */}
              {!m.blurhash && !chargees[cle(m, "galerie")] ? (
                <span className="squelette absolute inset-0 rounded-none" />
              ) : null}
              <Image
                src={urlMedia(m.cloudinary_id, "galerie", { origine: m.origine })}
                unoptimized={servieParCloudinary(m.cloudinary_id)}
                alt={m.alt || alt}
                fill
                sizes="(max-width: 672px) 100vw, 672px"
                className="object-cover"
                priority={i === 0}
                /* La photo d'à côté est la prochaine que le doigt amènera :
                   la charger tout de suite évite d'arriver sur un flou. */
                loading={i !== 0 && Math.abs(i - index) <= 1 ? "eager" : undefined}
                placeholder={m.blurhash ? "blur" : "empty"}
                blurDataURL={m.blurhash ?? undefined}
                onLoad={() => setChargees((c) => ({ ...c, [cle(m, "galerie")]: true }))}
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
              unoptimized={servieParCloudinary(m.cloudinary_id)}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {plein ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Galerie plein écran"
          /* `dvh` et non `vh` : sur iOS la barre d'outils se replie au
             défilement et `100vh` dépasse alors l'écran, ce qui décale la
             rangée de boutons sous le bord. */
          style={{ height: "100dvh" }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-text">
            <span className="text-meta">
              {index + 1} / {medias.length}
            </span>
            <button type="button" onClick={() => setPlein(false)} className="min-h-touch px-3 text-[13px] font-semibold" aria-label="Fermer le plein écran">
              Fermer
            </button>
          </div>

          {/* Piste à défilement natif, comme celle du haut de fiche.
              Auparavant une seule balise portait la photo courante : au
              balayage, son `src` changeait et l'écran sautait d'une image à
              l'autre. Ici les photos sont côte à côte et c'est la piste qui
              glisse — le doigt tient l'image pendant tout son trajet, et le
              relâchement laisse l'inertie du navigateur finir la course.

              Le défilement natif donne gratuitement ce qu'un glissement fait
              main imite mal : inertie, résistance aux extrémités, reprise en
              cours de course, roulette et clavier. `scroll-snap-stop: always`
              interdit de sauter deux photos d'un geste ample. */}
          <div
            ref={pistePlein}
            className="defilement-x min-h-0 flex-1 touch-pan-x"
            style={{ scrollSnapStop: "always" }}
            onScroll={surDefilementPlein}
          >
            {medias.map((m, i) => {
              const chargee = !!chargees[cle(m, "plein")];
              return (
                <div
                  key={m.id}
                  className="flex h-full w-full shrink-0 snap-center items-center justify-center"
                >
                  {/* La photo dicte la taille de son cadre plutôt que
                      l'inverse : sur un écran portrait, un `object-contain`
                      plein cadre laisse deux bandes noires, et la marque posée
                      sur le cadre flotterait à côté de l'image au lieu d'être
                      dessus — donc hors de la capture recadrée. */}
                  <span
                    className="photo-protegee relative inline-flex max-h-full"
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <Image
                      src={urlMedia(m.cloudinary_id, "plein", { origine: m.origine })}
                      unoptimized={servieParCloudinary(m.cloudinary_id)}
                      alt={m.alt || alt}
                      width={m.largeur || 1600}
                      height={m.hauteur || 1200}
                      sizes="100vw"
                      /* Les deux photos encadrant celle qu'on regarde sont
                         chargées d'avance : au balayage suivant, l'image est
                         déjà là. Les autres attendent d'approcher. */
                      loading={Math.abs(i - index) <= 1 ? "eager" : "lazy"}
                      placeholder={m.blurhash ? "blur" : "empty"}
                      blurDataURL={m.blurhash ?? undefined}
                      onLoad={() => setChargees((c) => ({ ...c, [cle(m, "plein")]: true }))}
                      className={clsx(
                        "object-contain transition-opacity duration-300",
                        // Avec un blurhash, l'aperçu flou est peint par
                        // next/image sur cette même balise : la masquer
                        // reviendrait à le supprimer et à rendre un carré noir.
                        chargee || m.blurhash ? "opacity-100" : "opacity-0"
                      )}
                      style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
                    />
                    {!chargee ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <ChargementMoto taille="compact" texte="Chargement de la photo" />
                      </span>
                    ) : null}
                    {m.origine === "reelle" &&
                    !filigraneIncruste(m.cloudinary_id, "plein", { origine: m.origine }) ? (
                      <Filigrane />
                    ) : null}
                  </span>
                </div>
              );
            })}
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
