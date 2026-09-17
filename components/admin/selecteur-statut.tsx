"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Statut } from "@/lib/types";
import { LIBELLE_STATUT } from "@/lib/types";
import { changerStatut } from "@/app/admin/actions";

const CHOIX: Statut[] = [
  "brouillon", "dispo_immediate", "disponible", "reserve", "vendu", "archive",
];

const COULEUR: Record<Statut, string> = {
  brouillon: "border-gold text-gold-light",
  dispo_immediate: "border-immediat text-immediat",
  disponible: "border-dispo text-dispo",
  reserve: "border-reserve text-reserve",
  vendu: "border-vendu text-vendu",
  archive: "border-line text-dim",
};

/**
 * Bascule de statut en un geste, sans rechargement (10.2).
 * Mise à jour optimiste, appel serveur en arrière-plan, retour au statut
 * précédent en cas d'échec.
 */
export function SelecteurStatut({ id, statut }: { id: string; statut: Statut }) {
  const router = useRouter();
  const [valeur, setValeur] = useState<Statut>(statut);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={valeur}
        aria-label="Statut de la moto"
        disabled={enCours}
        onChange={(e) => {
          const suivant = e.target.value as Statut;
          const precedent = valeur;
          setValeur(suivant);
          setErreur(null);
          demarrer(async () => {
            try {
              const r = await changerStatut(id, suivant);
              // Le verrou de publication renvoie son refus au lieu de le lever :
              // l'exploitant doit lire ce qui manque, pas « une erreur est
              // survenue ».
              if (!r.ok) {
                setValeur(precedent);
                setErreur(r.erreur);
                return;
              }
              // Le reste de l'écran dépend du statut : badge public, colonnes
              // de la liste, lien vers la fiche en ligne. Seul le serveur sait
              // ce qu'il devient.
              router.refresh();
            } catch {
              setValeur(precedent);
              setErreur("Échec réseau — réessayez.");
            }
          });
        }}
        className={clsx(
          "min-h-touch rounded-card border bg-surface-hi px-2.5 text-[12.5px] font-semibold",
          COULEUR[valeur],
          enCours && "opacity-60"
        )}
      >
        {CHOIX.map((s) => (
          <option key={s} value={s} className="bg-surface text-text">
            {LIBELLE_STATUT[s]}
          </option>
        ))}
      </select>
      {erreur ? (
        <span role="alert" className="basis-full text-[11px] leading-snug text-vendu">
          {erreur}
        </span>
      ) : null}
    </div>
  );
}
