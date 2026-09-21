"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Media } from "@/lib/types";
import { filigraneIncruste, servieParCloudinary, urlMedia } from "@/lib/cloudinary";
import { Filigrane } from "@/components/ui/filigrane";
import { ChargementMoto } from "@/components/ui/chargement-moto";
import { pister } from "@/lib/analytics";

/** Au-delà de ce déplacement du doigt, on change de photo plutôt que de revenir en place. */
const SEUIL_BALAYAGE = 56;

export function GalerieFiche({ medias, alt }: { medias: Media[]; alt: string }) {
  const piste = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [plein, setPlein] = useState(false);
  /** Déplacement du doigt en cours sur la photo plein écran, en pixels. */
  const [glissement, setGlissement] = useState(0);
  const geste = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  /* Une photo déjà affichée une fois reste marquée comme chargée : en revenant
     dessus elle sort du cache du navigateur, et refaire clignoter le voile de
     chargement donnerait l'impression d'une attente qui n'existe pas. */
  const [chargees, setChargees] = useState<Record<string, true>>({});
  /* La vignette de la piste et la photo plein écran sont deux fichiers
     distincts du même média : les compter séparément, sinon le plein écran se
     croirait prêt parce que sa miniature l'est. */
  const cle = (m: Media, taille: "galerie" | "plein") => `${m.id}:${taille}`;

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
  const pleinCharge = !!chargees[cle(courant, "plein")];
  /* Les deux photos encadrant la photo affichée sont montées hors champ pour
     que le navigateur les télécharge d'avance : au balayage suivant, l'image
     est déjà en cache et s'affiche d'un coup. Ce sont bien des `next/image`
     avec les mêmes `sizes` et dimensions que la photo visible, sinon le
     navigateur choisirait une autre taille dans le `srcset` et le
     préchargement porterait sur un fichier qui ne sera jamais réclamé. */
  const voisines = plein
    ? [medias[index - 1], medias[index + 1]].filter((m): m is Media => Boolean(m))
    : [];

  const allerA = (i: number) => {
    const el = piste.current;
    setIndex(i);
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  /* En plein écran la photo remplit l'écran : il n'y a plus de piste à faire
     défiler, donc le balayage est reconstitué à la main. Le doigt tire la
     photo pendant le geste — sans ce retour, on ne sait pas qu'il se passe
     quelque chose avant d'avoir lâché. Aux deux extrémités la photo résiste au
     lieu de suivre, ce qui dit « il n'y a rien de plus par là ». */
  const debutGeste = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      geste.current = null;
      setGlissement(0);
      return;
    }
    geste.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, horizontal: null };
  };

  const suiviGeste = (e: React.TouchEvent) => {
    const g = geste.current;
    if (!g || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - g.x;
    const dy = e.touches[0].clientY - g.y;
    if (g.horizontal === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!g.horizontal) return;
    const auBout = (dx > 0 && index === 0) || (dx < 0 && index === medias.length - 1);
    setGlissement(auBout ? dx / 4 : dx);
  };

  const finGeste = (e: React.TouchEvent) => {
    const g = geste.current;
    geste.current = null;
    setGlissement(0);
    if (!g?.horizontal) return;
    const dx = (e.changedTouches[0]?.clientX ?? g.x) - g.x;
    if (Math.abs(dx) < SEUIL_BALAYAGE) return;
    const cible = dx < 0 ? index + 1 : index - 1;
    if (cible < 0 || cible > medias.length - 1) return;
    allerA(cible);
    pister("galerie_balayee", { index: cible });
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
          <div
            className="flex min-h-0 flex-1 touch-pan-y items-center justify-center overflow-hidden"
            onTouchStart={debutGeste}
            onTouchMove={suiviGeste}
            onTouchEnd={finGeste}
            onTouchCancel={finGeste}
          >
            <span
              className="photo-protegee relative inline-flex max-h-full"
              onContextMenu={(e) => e.preventDefault()}
              style={{
                transform: glissement ? `translateX(${glissement}px)` : undefined,
                transition: glissement ? "none" : "transform 200ms ease-out",
              }}
            >
              {/* `key` sur l'identifiant : sans elle React réutilise la même
                  balise d'une photo à l'autre, et le navigateur garde
                  l'ancienne image à l'écran jusqu'à ce que la nouvelle soit
                  décodée — un fondu qui ne correspond à rien. */}
              <Image
                key={courant.id}
                src={urlMedia(courant.cloudinary_id, "plein", { origine: courant.origine })}
                unoptimized={servieParCloudinary(courant.cloudinary_id)}
                alt={courant.alt || alt}
                width={courant.largeur || 1600}
                height={courant.hauteur || 1200}
                sizes="100vw"
                placeholder={courant.blurhash ? "blur" : "empty"}
                blurDataURL={courant.blurhash ?? undefined}
                onLoad={() => setChargees((c) => ({ ...c, [cle(courant, "plein")]: true }))}
                className={clsx(
                  "object-contain transition-opacity duration-300",
                  // Avec un blurhash, l'aperçu flou est peint par next/image
                  // sur cette même balise : la masquer reviendrait à le
                  // supprimer et à rendre un carré noir.
                  pleinCharge || courant.blurhash ? "opacity-100" : "opacity-0"
                )}
                style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%" }}
              />
              {!pleinCharge ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <ChargementMoto taille="compact" texte="Chargement de la photo" />
                </span>
              ) : null}
              {courant.origine === "reelle" &&
              !filigraneIncruste(courant.cloudinary_id, "plein", { origine: courant.origine }) ? (
                <Filigrane />
              ) : null}
            </span>
          </div>
          <div aria-hidden className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0">
            {voisines.map((m) => (
              <Image
                key={m.id}
                src={urlMedia(m.cloudinary_id, "plein", { origine: m.origine })}
                unoptimized={servieParCloudinary(m.cloudinary_id)}
                alt=""
                width={m.largeur || 1600}
                height={m.hauteur || 1200}
                sizes="100vw"
                loading="eager"
              />
            ))}
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
