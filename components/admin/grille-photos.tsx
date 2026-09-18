"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import clsx from "clsx";
import type { Media, Origine, Vue } from "@/lib/types";
import { LIBELLE_VUE, ORIGINES, VUES } from "@/lib/types";
import { servieParCloudinary, urlMedia } from "@/lib/cloudinary";
import { majPhoto, reordonnerPhotos, supprimerPhoto } from "@/app/admin/actions";

/**
 * Grille ordonnée des photos : réordonnancement, édition de `vue`, `origine`,
 * `legende` et `alt` (10.3).
 */
export function GrillePhotos({ motoId, medias: initiaux }: { motoId: string; medias: Media[] }) {
  const [medias, setMedias] = useState(initiaux);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [, demarrer] = useTransition();

  const deplacer = (index: number, delta: number) => {
    const cible = index + delta;
    if (cible < 0 || cible >= medias.length) return;
    const copie = [...medias];
    [copie[index], copie[cible]] = [copie[cible], copie[index]];
    const reordonnes = copie.map((m, i) => ({ ...m, ordre: i + 1 }));
    setMedias(reordonnes);
    demarrer(async () => {
      await reordonnerPhotos(motoId, reordonnes.map((m) => m.id));
    });
  };

  const modifier = (id: string, patch: Partial<Media>) => {
    setMedias((liste) => liste.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    demarrer(async () => {
      await majPhoto(id, motoId, patch as Record<string, unknown>);
    });
  };

  const retirer = (id: string) => {
    setASupprimer(null);
    setMedias((liste) => liste.filter((m) => m.id !== id));
    demarrer(async () => {
      await supprimerPhoto(id, motoId);
    });
  };

  if (!medias.length) {
    return (
      <p className="carte p-6 text-center text-corps text-dim">
        Aucune photo. Utilisez l&apos;import en masse ou l&apos;ajout depuis le téléphone.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {medias.map((m, i) => (
        <li key={m.id} className="carte overflow-hidden">
          <div className="relative aspect-[4/3] bg-surface-hi">
            <Image
              src={urlMedia(m.cloudinary_id, "vignette", { origine: m.origine })}
              unoptimized={servieParCloudinary(m.cloudinary_id)}
              alt={m.alt}
              fill
              sizes="200px"
              className="object-cover"
            />
            <span className="absolute left-1.5 top-1.5 rounded-card bg-black/70 px-2 py-0.5 text-[10px] font-bold text-text">
              {i + 1}
            </span>
            {i === 0 ? (
              <span className="absolute right-1.5 top-1.5 rounded-card bg-gold px-2 py-0.5 text-[10px] font-bold text-on-gold">
                Couverture
              </span>
            ) : null}
            {!m.alt?.trim() ? (
              <span className="absolute bottom-1.5 left-1.5 rounded-card bg-vendu px-2 py-0.5 text-[10px] font-bold text-white">
                alt manquant
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-line px-1.5 py-1">
            <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0}
              className="min-h-touch px-2 text-chrome disabled:opacity-30" aria-label="Déplacer avant">
              ←
            </button>
            <button type="button" onClick={() => setOuvert(ouvert === m.id ? null : m.id)}
              className="min-h-touch px-2 text-[11.5px] font-semibold text-gold-light">
              {LIBELLE_VUE[m.vue]}
            </button>
            <button type="button" onClick={() => deplacer(i, 1)} disabled={i === medias.length - 1}
              className="min-h-touch px-2 text-chrome disabled:opacity-30" aria-label="Déplacer après">
              →
            </button>
          </div>

          {ouvert === m.id ? (
            <div className="space-y-2 border-t border-line p-2.5">
              <select value={m.vue} onChange={(e) => modifier(m.id, { vue: e.target.value as Vue })}
                className="champ min-h-[36px] text-[12px]" aria-label="Vue">
                {VUES.map((v) => (
                  <option key={v} value={v}>{LIBELLE_VUE[v]}</option>
                ))}
              </select>
              <select value={m.origine} onChange={(e) => modifier(m.id, { origine: e.target.value as Origine })}
                className="champ min-h-[36px] text-[12px]" aria-label="Origine">
                {ORIGINES.map((o) => (
                  <option key={o} value={o}>{o === "reelle" ? "Photo réelle" : "Visuel constructeur"}</option>
                ))}
              </select>
              <input value={m.alt} onChange={(e) => modifier(m.id, { alt: e.target.value })}
                placeholder="Texte alternatif" aria-label="Texte alternatif"
                className={clsx("champ min-h-[36px] text-[12px]", !m.alt?.trim() && "border-vendu")} />
              <input value={m.legende ?? ""} onChange={(e) => modifier(m.id, { legende: e.target.value })}
                placeholder="Légende" aria-label="Légende" className="champ min-h-[36px] text-[12px]" />
              {/* Deux gestes : sur un téléphone, ce bouton est à un pouce des
                  flèches de réordonnancement. */}
              {aSupprimer === m.id ? (
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => retirer(m.id)}
                    className="min-h-[36px] flex-1 rounded-card border border-vendu bg-vendu/15 text-[12px] font-semibold text-vendu">
                    Confirmer
                  </button>
                  <button type="button" onClick={() => setASupprimer(null)}
                    className="min-h-[36px] flex-1 rounded-card border border-line text-[12px] font-semibold text-chrome">
                    Annuler
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setASupprimer(m.id)}
                  className="min-h-[36px] w-full rounded-card border border-line text-[12px] font-semibold text-dim hover:border-vendu/60 hover:text-vendu">
                  Supprimer cette photo
                </button>
              )}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
