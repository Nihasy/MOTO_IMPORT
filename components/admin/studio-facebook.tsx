"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { ar, dateFr } from "@/lib/format";
import {
  MAX_ALBUM, TAILLE_SELECTION_VARIEE, legendeAlbum, legendePhoto, selectionVariee,
  type Album, type LigneStudio,
} from "@/lib/facebook";
import { LIBELLE_CATEGORIE, miseEnVenteDe } from "@/lib/types";
import {
  consignerPublicationManuelle, publierSurFacebook, type ResultatFb,
} from "@/app/admin/facebook/actions";

export type Candidate = LigneStudio & {
  vignette: string | null;
  historique: { nb: number; derniere: string } | null;
};

const urlCarte = (ref: string) => `/api/facebook/carte?ref=${encodeURIComponent(ref)}`;

/**
 * Studio Facebook : de la liste filtrée à l'album prêt à partir.
 *
 * Les légendes sont générées une fois, à l'ajout de la moto, puis appartiennent
 * à l'exploitant : les regénérer à chaque frappe effacerait une correction
 * faite à la main. Le texte du post suit la sélection tant qu'on n'y a pas
 * touché, et se fige dès qu'on le modifie.
 */
export function StudioFacebook({
  candidates,
  titreInitial,
  campagne,
  configure,
}: {
  candidates: Candidate[];
  titreInitial: string;
  campagne: string;
  configure: boolean;
}) {
  const parRef = useMemo(() => new Map(candidates.map((c) => [c.reference, c])), [candidates]);
  const [selection, setSelection] = useState<string[]>([]);
  const [legendes, setLegendes] = useState<Record<string, string>>({});
  const [titre, setTitre] = useState(titreInitial);
  const [titreApercu, setTitreApercu] = useState(titreInitial);
  const [couverture, setCouverture] = useState(true);
  const [messageSaisi, setMessageSaisi] = useState<string | null>(null);
  const [programme, setProgramme] = useState("");
  const [lienManuel, setLienManuel] = useState("");
  const [etape, setEtape] = useState<"composer" | "confirmer">("composer");
  const [resultat, setResultat] = useState<ResultatFb | null>(null);
  const [telechargement, setTelechargement] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const choisies = selection.map((r) => parRef.get(r)!).filter(Boolean);
  const messageAuto = legendeAlbum(titre, choisies, campagne);
  const message = messageSaisi ?? messageAuto;
  const plein = selection.length >= MAX_ALBUM;

  const ajouter = (refs: string[]) => {
    setResultat(null);
    setEtape("composer");
    setSelection((avant) => {
      const suite = [...avant];
      for (const r of refs) if (!suite.includes(r) && suite.length < MAX_ALBUM) suite.push(r);
      return suite;
    });
    setLegendes((avant) => {
      const suite = { ...avant };
      for (const r of refs) if (!suite[r] && parRef.get(r)) suite[r] = legendePhoto(parRef.get(r)!, campagne);
      return suite;
    });
  };
  const retirer = (ref: string) => {
    setEtape("composer");
    setSelection((s) => s.filter((r) => r !== ref));
  };
  const deplacer = (i: number, sens: -1 | 1) =>
    setSelection((s) => {
      const j = i + sens;
      if (j < 0 || j >= s.length) return s;
      const suite = [...s];
      [suite[i], suite[j]] = [suite[j], suite[i]];
      return suite;
    });

  const album = (): Album => ({
    titre: titre.trim(),
    message: message.trim(),
    couverture,
    motos: selection.map((ref) => ({ ref, legende: (legendes[ref] ?? "").trim() })),
  });

  const telechargerKit = async () => {
    setTelechargement("Fabrication des cartes…");
    try {
      const rep = await fetch("/api/facebook/kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(album()),
      });
      if (!rep.ok) {
        const j = (await rep.json().catch(() => ({}))) as { erreur?: string };
        throw new Error(j.erreur ?? `Erreur ${rep.status}`);
      }
      const url = URL.createObjectURL(await rep.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${campagne}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setTelechargement(null);
    } catch (e) {
      setTelechargement(`Kit impossible : ${(e as Error).message}`);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setTelechargement("Texte du post copié.");
    } catch {
      setTelechargement("Copie refusée par le navigateur : sélectionnez le texte à la main.");
    }
  };

  const programmeIso = programme ? new Date(programme).toISOString() : null;
  const quandLisible = programme
    ? new Date(programme).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })
    : "maintenant";

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Colonne 1 : les motos qui répondent aux filtres */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold">Motos en vente ({candidates.length})</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-fantome px-3"
              disabled={!candidates.length}
              onClick={() => ajouter(selectionVariee(candidates, TAILLE_SELECTION_VARIEE).map((m) => m.reference))}
              title="Une moto par marque à tour de rôle, les plus récentes d'abord, rangées par prix"
            >
              Sélection variée ({TAILLE_SELECTION_VARIEE})
            </button>
          </div>
        </div>
        {candidates.length === 0 ? (
          <p className="carte p-4 text-meta text-dim">
            Aucune moto en vente ne répond à ces filtres. Élargissez un critère.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {candidates.map((m) => {
              const pris = selection.includes(m.reference);
              return (
                <li key={m.reference} className={clsx("carte flex items-center gap-3 p-2", pris && "border-gold")}>
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-surface-hi">
                    {m.vignette ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.vignette} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-corps font-semibold">
                      {m.marque} {m.modele} {m.annee}
                    </p>
                    <p className="truncate text-meta text-dim">
                      {m.reference} · {ar(m.prix_ttc)} · {LIBELLE_CATEGORIE[m.categorie]} ·{" "}
                      {miseEnVenteDe(m) === "local" ? "au local" : "sur commande"}
                    </p>
                    <p className={clsx("text-[11px]", m.historique ? "text-dim" : "text-gold-light")}>
                      {m.historique
                        ? `Publiée ${m.historique.nb} fois · dernière le ${dateFr(m.historique.derniere)}`
                        : "Jamais publiée"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={clsx("shrink-0 px-3", pris ? "btn-fantome" : "btn-or")}
                    disabled={!pris && plein}
                    onClick={() => (pris ? retirer(m.reference) : ajouter([m.reference]))}
                  >
                    {pris ? "Retirer" : "Ajouter"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Colonne 2 : l'album en composition */}
      <section className="lg:sticky lg:top-16 lg:self-start">
        <div className="carte p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-semibold">
              Album · {selection.length}/{MAX_ALBUM}
            </h2>
            {selection.length ? (
              <button type="button" className="text-[12.5px] text-dim hover:text-text" onClick={() => setSelection([])}>
                Vider
              </button>
            ) : null}
          </div>

          {selection.length === 0 ? (
            <p className="text-meta text-dim">
              Ajoutez des motos à gauche, ou laissez la sélection variée en choisir {TAILLE_SELECTION_VARIEE}.
            </p>
          ) : (
            <>
              <label className="mb-1 block text-[12px] font-semibold text-chrome" htmlFor="titre-album">
                Titre (couverture et première ligne du post)
              </label>
              <input
                id="titre-album"
                className="champ mb-2 w-full"
                value={titre}
                maxLength={200}
                onChange={(e) => setTitre(e.target.value)}
                onBlur={() => setTitreApercu(titre)}
              />
              <label className="mb-3 flex items-center gap-2 text-meta text-chrome">
                <input type="checkbox" checked={couverture} onChange={(e) => setCouverture(e.target.checked)} />
                Image de couverture en tête d&apos;album
              </label>

              {couverture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/facebook/carte?couverture=1&refs=${selection.join(",")}&titre=${encodeURIComponent(titreApercu)}`}
                  alt="Aperçu de la couverture"
                  className="mb-3 w-40 rounded border border-line"
                />
              ) : null}

              <ol className="space-y-3">
                {choisies.map((m, i) => (
                  <li key={m.reference} className="flex gap-3 border-t border-line pt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={urlCarte(m.reference)}
                      alt={`Carte ${m.reference}`}
                      className="w-28 shrink-0 self-start rounded border border-line"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-meta font-semibold">
                          {i + 1}. {m.marque} {m.modele} · {m.reference}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button type="button" className="px-1.5 text-dim hover:text-text" aria-label="Monter" onClick={() => deplacer(i, -1)}>
                            ↑
                          </button>
                          <button type="button" className="px-1.5 text-dim hover:text-text" aria-label="Descendre" onClick={() => deplacer(i, 1)}>
                            ↓
                          </button>
                          <button type="button" className="px-1.5 text-dim hover:text-vendu" aria-label="Retirer" onClick={() => retirer(m.reference)}>
                            ✕
                          </button>
                        </span>
                      </div>
                      <textarea
                        className="champ h-32 w-full font-mono text-[12px] leading-snug"
                        value={legendes[m.reference] ?? ""}
                        aria-label={`Légende de la photo ${m.reference}`}
                        onChange={(e) => setLegendes((l) => ({ ...l, [m.reference]: e.target.value }))}
                      />
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-4 border-t border-line pt-3">
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-[12px] font-semibold text-chrome" htmlFor="message-album">
                    Texte du post {messageSaisi !== null ? "(modifié à la main)" : "(suit la sélection)"}
                  </label>
                  <span className="flex gap-3 text-[12px]">
                    {messageSaisi !== null ? (
                      <button type="button" className="text-gold-light" onClick={() => setMessageSaisi(null)}>
                        Régénérer
                      </button>
                    ) : null}
                    <button type="button" className="text-gold-light" onClick={copier}>
                      Copier
                    </button>
                  </span>
                </div>
                <textarea
                  id="message-album"
                  className="champ h-48 w-full text-[13px] leading-snug"
                  value={message}
                  onChange={(e) => setMessageSaisi(e.target.value)}
                />
              </div>

              {/* Voie manuelle : toujours disponible */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <button type="button" className="btn-fantome px-4" onClick={telechargerKit}>
                  Télécharger le kit (.zip)
                </button>
                {telechargement ? <span className="text-meta text-dim">{telechargement}</span> : null}
              </div>
              <details className="mt-2 text-meta">
                <summary className="cursor-pointer text-chrome">Je l&apos;ai publié à la main</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    className="champ min-w-0 flex-1"
                    placeholder="Lien du post (facultatif)"
                    value={lienManuel}
                    onChange={(e) => setLienManuel(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-fantome px-3"
                    disabled={enCours}
                    onClick={() =>
                      demarrer(async () => setResultat(await consignerPublicationManuelle(album(), lienManuel)))
                    }
                  >
                    Consigner
                  </button>
                </div>
              </details>

              {/* Voie directe : seulement si la page est reliée */}
              <div className="mt-4 border-t border-line pt-3">
                {!configure ? (
                  <p className="text-meta text-dim">
                    Publication directe non configurée : ajoutez <code>FACEBOOK_PAGE_ID</code> et{" "}
                    <code>FACEBOOK_PAGE_TOKEN</code> dans Vercel pour publier et programmer d&apos;ici.
                  </p>
                ) : etape === "composer" ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col text-[12px] text-chrome">
                      Programmer (facultatif)
                      <input
                        type="datetime-local"
                        className="champ mt-1"
                        value={programme}
                        onChange={(e) => setProgramme(e.target.value)}
                      />
                    </label>
                    <button type="button" className="btn-or px-4" onClick={() => { setResultat(null); setEtape("confirmer"); }}>
                      {programme ? "Programmer sur la page…" : "Publier sur la page…"}
                    </button>
                  </div>
                ) : (
                  <div className="rounded border border-gold p-3">
                    <p className="text-meta">
                      {couverture ? selection.length + 1 : selection.length} photos partent sur la page Facebook,{" "}
                      <strong>{quandLisible}</strong>, avec le texte ci-dessus. Relu ?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn-fantome px-4" disabled={enCours} onClick={() => setEtape("composer")}>
                        Revenir
                      </button>
                      <button
                        type="button"
                        className="btn-or px-4"
                        disabled={enCours}
                        onClick={() =>
                          demarrer(async () => {
                            const r = await publierSurFacebook(album(), programmeIso);
                            setResultat(r);
                            if (r.ok) setEtape("composer");
                          })
                        }
                      >
                        {enCours ? "Envoi en cours…" : "Confirmer l'envoi"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {resultat ? (
                <p className={clsx("mt-3 text-meta", resultat.ok ? "text-dispo" : "text-vendu")}>
                  {resultat.ok ? resultat.message : resultat.erreur}
                  {resultat.ok && resultat.lien ? (
                    <>
                      {" "}
                      <a href={resultat.lien} target="_blank" rel="noopener" className="font-semibold text-gold-light">
                        Voir le post ↗
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
