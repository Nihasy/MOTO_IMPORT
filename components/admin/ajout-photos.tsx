"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Moto } from "@/lib/types";
import { LIBELLE_VUE, MIN_PHOTOS, VUES } from "@/lib/types";
import { analyserNomFichier } from "@/lib/medias";
import { altParDefaut } from "@/lib/medias";
import { compresser, fileDEnvoi, televerser, versDataUrl } from "@/lib/upload-client";

/**
 * Ajout rapide depuis un téléphone (7.6) : prise de photo directe,
 * compression locale, envoi par file de trois, enregistrement en base.
 */
export function AjoutPhotos({ moto, nbExistantes }: { moto: Moto; nbExistantes: number }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<"pret" | "traitement" | "fini">("pret");
  const [avancement, setAvancement] = useState({ faits: 0, total: 0 });
  const [message, setMessage] = useState<string | null>(null);

  const traiter = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return;
    setEtat("traitement");
    setMessage(null);
    setAvancement({ faits: 0, total: fichiers.length });

    const liste = Array.from(fichiers);
    const resultats = await fileDEnvoi(
      liste,
      async (f, i) => {
        const pret = await compresser(f);
        let envoi;
        try {
          envoi = await televerser(pret, `moto-import/${moto.reference}`);
        } catch {
          // Cloudinary absent ou refusé : on conserve l'image compressée en base.
          envoi = await versDataUrl(pret);
        }
        const analyse = analyserNomFichier(f.name);
        const vue = analyse.valide ? analyse.vue : "autre";
        return {
          moto_id: moto.id,
          type: "photo" as const,
          origine: analyse.valide ? analyse.origine : ("reelle" as const),
          vue,
          cloudinary_id: envoi.cloudinary_id,
          largeur: envoi.largeur,
          hauteur: envoi.hauteur,
          blurhash: envoi.blurhash || null,
          ordre: nbExistantes + i + 1,
          legende: null,
          alt: altParDefaut(moto.marque, moto.modele, moto.annee, vue, LIBELLE_VUE[vue]),
          date_prise: moto.date_photos ?? null,
        };
      },
      3,
      (faits, total) => setAvancement({ faits, total })
    );

    const medias = resultats.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const echecs = resultats.length - medias.length;

    if (medias.length) {
      const rep = await fetch("/api/import/medias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichier_nom: `ajout-${moto.reference}`, medias }),
      });
      if (!rep.ok) {
        const { erreur } = (await rep.json().catch(() => ({}))) as { erreur?: string };
        setMessage(erreur ?? "Enregistrement refusé.");
        setEtat("pret");
        return;
      }
    }

    setMessage(
      `${medias.length} photo${medias.length > 1 ? "s" : ""} ajoutée${medias.length > 1 ? "s" : ""}` +
        (echecs ? ` · ${echecs} échec(s)` : "")
    );
    setEtat("fini");
    if (champ.current) champ.current.value = "";
    router.refresh();
  };

  const manque = Math.max(0, MIN_PHOTOS[moto.etat] - nbExistantes);

  return (
    <section className="carte p-4">
      <h2 className="text-[17px] font-semibold">Ajouter des photos</h2>
      <p className="mt-1 text-meta text-dim">
        {manque
          ? `Encore ${manque} photo${manque > 1 ? "s" : ""} avant de pouvoir publier (${moto.etat}).`
          : `Seuil atteint : ${nbExistantes} photos.`}{" "}
        Les fichiers nommés {moto.reference}_01_34ad.jpg sont classés automatiquement.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="btn-or cursor-pointer">
          Prendre une photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={etat === "traitement"}
            onChange={(e) => void traiter(e.target.files)}
          />
        </label>
        <label className="btn-fantome cursor-pointer">
          Choisir des fichiers
          <input
            ref={champ}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={etat === "traitement"}
            onChange={(e) => void traiter(e.target.files)}
          />
        </label>
      </div>

      {etat === "traitement" ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hi">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${(avancement.faits / Math.max(avancement.total, 1)) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-meta text-chrome">
            {avancement.faits} / {avancement.total} — compression et envoi en cours…
          </p>
        </div>
      ) : null}

      {message ? (
        <p role="status" className="mt-3 rounded-card border border-line bg-surface-hi px-3 py-2 text-meta text-chrome">
          {message}
        </p>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-meta text-dim">Codes de vue reconnus</summary>
        <p className="mt-1.5 text-[11.5px] text-dim">
          {VUES.map((v) => LIBELLE_VUE[v]).join(" · ")}
        </p>
      </details>
    </section>
  );
}
