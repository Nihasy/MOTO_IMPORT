"use client";

import { useState, useTransition } from "react";
import { signalerVentes, type ResultatFb } from "@/app/admin/facebook/actions";

/**
 * Commentaire « VENDUE » sous un post. Deux temps, comme la publication : un
 * commentaire part en public sous le nom de la page.
 */
export function BoutonVentes({
  publicationId,
  refs,
  configure,
}: {
  publicationId: string;
  refs: string[];
  configure: boolean;
}) {
  const [confirmer, setConfirmer] = useState(false);
  const [resultat, setResultat] = useState<ResultatFb | null>(null);
  const [enCours, demarrer] = useTransition();

  if (!configure) return <span className="text-dim">Publication directe non configurée</span>;
  if (resultat?.ok) return <span className="text-dispo">{resultat.message}</span>;

  return (
    <span className="flex items-center gap-2">
      {resultat && !resultat.ok ? <span className="text-vendu">{resultat.erreur}</span> : null}
      {confirmer ? (
        <>
          <button type="button" className="btn-fantome px-3" onClick={() => setConfirmer(false)} disabled={enCours}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-or px-3"
            disabled={enCours}
            onClick={() => demarrer(async () => setResultat(await signalerVentes(publicationId)))}
          >
            {enCours ? "Envoi…" : `Confirmer : commenter « VENDUE » (${refs.length})`}
          </button>
        </>
      ) : (
        <button type="button" className="btn-fantome px-3" onClick={() => setConfirmer(true)}>
          Commenter « VENDUE »
        </button>
      )}
    </span>
  );
}
