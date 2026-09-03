"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Moto } from "@/lib/types";
import { LIBELLE_VUE, MIN_PHOTOS } from "@/lib/types";
import { altParDefaut, analyserNomFichier, grouperParReference } from "@/lib/medias";
import { compresser, fileDEnvoi, televerser, versDataUrl } from "@/lib/upload-client";

type Etat = "depot" | "reconciliation" | "envoi" | "rapport";

type Rapport = {
  lot_id: string;
  total: number;
  reussis: number;
  echoues: number;
};

/** Écran d'import en masse des photos (7.3). */
export function ImportPhotos({ motos }: { motos: Pick<Moto, "id" | "reference" | "marque" | "modele" | "annee" | "etat" | "date_photos">[] }) {
  const router = useRouter();
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [etat, setEtat] = useState<Etat>("depot");
  const [avancement, setAvancement] = useState({ faits: 0, total: 0 });
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [assignations, setAssignations] = useState<Record<string, string>>({});

  const parReference = useMemo(() => {
    const index = new Map<string, (typeof motos)[number]>();
    for (const m of motos) index.set(m.reference.toUpperCase(), m);
    return index;
  }, [motos]);

  const analyse = useMemo(() => grouperParReference(fichiers.map((f) => f.name)), [fichiers]);

  const deposer = (liste: FileList | null) => {
    if (!liste?.length) return;
    const tous = Array.from(liste).slice(0, 300);
    setFichiers(tous);
    setEtat("reconciliation");
    setErreur(null);
    setRapport(null);
  };

  const envoyer = async () => {
    setEtat("envoi");
    setErreur(null);

    // Fichier -> moto : par référence lue dans le nom, ou par assignation manuelle.
    const aTraiter: { fichier: File; motoId: string; ordre: number; vue: string; origine: "reelle" | "constructeur" }[] = [];
    for (const f of fichiers) {
      const a = analyserNomFichier(f.name);
      if (a.valide) {
        const moto = parReference.get(a.reference);
        if (moto) {
          aTraiter.push({ fichier: f, motoId: moto.id, ordre: a.ordre, vue: a.vue, origine: a.origine });
          continue;
        }
      }
      // Fichiers assignés à la main : ils passent après les photos nommées,
      // mais chacun garde un numéro distinct. Tous à 999 les faisait entrer en
      // collision les uns avec les autres sur `unique (moto_id, ordre)`.
      const manuel = assignations[f.name];
      if (manuel) {
        const rang = aTraiter.filter((x) => x.motoId === manuel).length;
        aTraiter.push({ fichier: f, motoId: manuel, ordre: 900 + rang, vue: "autre", origine: "reelle" });
      }
    }

    if (!aTraiter.length) {
      setErreur("Aucun fichier ne correspond à une moto existante. Assignez-les à la main ou créez les fiches d'abord.");
      setEtat("reconciliation");
      return;
    }

    setAvancement({ faits: 0, total: aTraiter.length });

    const resultats = await fileDEnvoi(
      aTraiter,
      async (x) => {
        const pret = await compresser(x.fichier);
        const moto = motos.find((m) => m.id === x.motoId)!;
        let envoi;
        try {
          envoi = await televerser(pret, `moto-import/${moto.reference}`);
        } catch {
          envoi = await versDataUrl(pret);
        }
        const vue = x.vue as keyof typeof LIBELLE_VUE;
        return {
          moto_id: x.motoId,
          type: "photo" as const,
          origine: x.origine,
          vue,
          cloudinary_id: envoi.cloudinary_id,
          largeur: envoi.largeur,
          hauteur: envoi.hauteur,
          blurhash: envoi.blurhash || null,
          ordre: x.ordre,
          legende: null,
          alt: altParDefaut(moto.marque, moto.modele, moto.annee, vue, LIBELLE_VUE[vue]),
          date_prise: moto.date_photos ?? null,
        };
      },
      3,
      (faits, total) => setAvancement({ faits, total })
    );

    const medias = resultats.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!medias.length) {
      setErreur("Tous les envois ont échoué.");
      setEtat("reconciliation");
      return;
    }

    const rep = await fetch("/api/import/medias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fichier_nom: `lot-${new Date().toISOString().slice(0, 10)}`, medias }),
    });
    const json = (await rep.json().catch(() => ({}))) as Rapport & { erreur?: string };
    if (!rep.ok) {
      setErreur(json.erreur ?? "Enregistrement refusé.");
      setEtat("reconciliation");
      return;
    }

    setRapport({
      lot_id: json.lot_id,
      total: aTraiter.length,
      reussis: json.reussis,
      echoues: aTraiter.length - json.reussis,
    });
    setEtat("rapport");
    router.refresh();
  };

  if (etat === "depot" || !fichiers.length) {
    return (
      <div className="carte p-6">
        <h2 className="text-[17px] font-semibold">Déposer les photos</h2>
        <p className="mt-1.5 text-corps text-chrome">
          Jusqu&apos;à 300 fichiers d&apos;un coup. Nommez-les{" "}
          <code className="rounded bg-surface-hi px-1.5 py-0.5 text-[12px] text-gold-light">
            MI-047_01_34ad.jpg
          </code>{" "}
          — suffixe <code className="rounded bg-surface-hi px-1 text-[12px]">-cat</code> pour un
          visuel constructeur. Les images sont redimensionnées à 2400 px et converties en WebP dans
          votre navigateur avant envoi.
        </p>
        <label
          className="mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface-hi text-center transition-colors hover:border-gold"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            deposer(e.dataTransfer.files);
          }}
        >
          <span className="text-corps font-semibold text-gold-light">Glisser-déposer ou choisir</span>
          <span className="text-meta text-dim">JPG, PNG, WebP, HEIC</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => deposer(e.target.files)}
          />
        </label>
      </div>
    );
  }

  if (etat === "rapport" && rapport) {
    return (
      <div className="carte p-5">
        <h2 className="text-[17px] font-semibold">Import terminé</h2>
        <ul className="mt-3 space-y-1 text-corps">
          <li className="text-dispo">{rapport.reussis} photo(s) enregistrée(s)</li>
          {rapport.echoues ? <li className="text-vendu">{rapport.echoues} échec(s)</li> : null}
          <li className="text-dim">Lot {rapport.lot_id.slice(0, 8)}…</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-fantome px-4"
            onClick={() => {
              setFichiers([]);
              setEtat("depot");
              setRapport(null);
            }}
          >
            Importer un autre lot
          </button>
          <button
            type="button"
            className="btn-fantome border-vendu/50 px-4 text-vendu"
            onClick={async () => {
              await fetch(`/api/import/lots/${rapport.lot_id}`, { method: "DELETE" });
              setFichiers([]);
              setEtat("depot");
              setRapport(null);
              router.refresh();
            }}
          >
            Annuler ce lot
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="carte p-4">
        <h2 className="text-[17px] font-semibold">
          Réconciliation — {fichiers.length} fichier{fichiers.length > 1 ? "s" : ""}
        </h2>

        <ul className="mt-3 divide-y divide-line">
          {analyse.groupes.map((g) => {
            const moto = parReference.get(g.reference);
            const min = moto ? MIN_PHOTOS[moto.etat] : 0;
            const assez = moto ? g.fichiers.length >= min : false;
            return (
              <li key={g.reference} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-corps font-medium">
                    {g.reference} ·{" "}
                    {moto ? `${moto.marque} ${moto.modele}` : (
                      <span className="text-vendu">référence inconnue</span>
                    )}
                  </span>
                  <span className="block text-meta text-dim">
                    {g.fichiers.length} photo{g.fichiers.length > 1 ? "s" : ""}
                    {moto ? ` · minimum ${min} (${moto.etat})` : " · aucune moto à cette référence"}
                    {g.doublonsOrdre.length ? ` · ordres en doublon : ${g.doublonsOrdre.join(", ")}` : ""}
                  </span>
                </span>
                <span
                  className={clsx(
                    "shrink-0 rounded-card px-2.5 py-1 text-badge font-semibold",
                    !moto ? "bg-vendu/20 text-vendu" : assez ? "bg-dispo/20 text-dispo" : "bg-gold/20 text-gold-light"
                  )}
                >
                  {!moto ? "✖" : assez ? "✔" : `⚠ min ${min}`}
                </span>
              </li>
            );
          })}
        </ul>

        {analyse.invalides.length ? (
          <div className="mt-4 rounded-card border border-vendu/40 bg-vendu/5 p-3">
            <p className="text-corps font-semibold text-vendu">
              {analyse.invalides.length} fichier(s) non conforme(s) — à assigner à la main
            </p>
            <ul className="mt-2 space-y-2">
              {analyse.invalides.map((f) => (
                <li key={f.fichier} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-meta text-chrome" title={f.motif}>
                    {f.fichier}
                  </span>
                  <select
                    value={assignations[f.fichier] ?? ""}
                    onChange={(e) =>
                      setAssignations((a) => ({ ...a, [f.fichier]: e.target.value }))
                    }
                    className="champ min-h-[36px] w-auto text-[12px]"
                    aria-label={`Assigner ${f.fichier} à une moto`}
                  >
                    <option value="">Ignorer</option>
                    {motos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.reference} · {m.marque} {m.modele}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {erreur ? (
          <p role="alert" className="mt-3 rounded-card border border-vendu/50 bg-vendu/10 px-3 py-2 text-meta text-vendu">
            {erreur}
          </p>
        ) : null}

        {etat === "envoi" ? (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hi">
              <div
                className="h-full bg-gold transition-all"
                style={{ width: `${(avancement.faits / Math.max(avancement.total, 1)) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-meta text-chrome">
              {avancement.faits} / {avancement.total} — compression, envoi (3 simultanés)…
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-or px-5" onClick={() => void envoyer()}>
              Lancer l&apos;import
            </button>
            <button
              type="button"
              className="btn-fantome px-4"
              onClick={() => {
                setFichiers([]);
                setEtat("depot");
              }}
            >
              Recommencer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
