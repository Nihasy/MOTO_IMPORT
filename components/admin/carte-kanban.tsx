"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Demande, DemandeStatut } from "@/lib/types";
import { DEMANDE_STATUTS, LIBELLE_DEMANDE_STATUT } from "@/lib/types";
import { dateFr } from "@/lib/format";
import { deplacerDemande } from "@/app/admin/actions";

/**
 * Carte de kanban. Le déplacement se fait en un geste.
 *
 * La version précédente demandait de choisir un statut puis de cliquer
 * « Déplacer » : deux gestes et un rechargement complet pour l'action la plus
 * répétée de l'écran. Ici le changement part au relâchement du sélecteur, la
 * carte suit tout de suite, et elle revient en arrière si le serveur refuse.
 */
export function CarteKanban({ demande }: { demande: Demande }) {
  const router = useRouter();
  const [statut, setStatut] = useState<DemandeStatut>(demande.statut);
  const [erreur, setErreur] = useState(false);
  const [enCours, demarrer] = useTransition();

  return (
    <div className={`rounded-card bg-surface-hi p-2.5 transition-opacity ${enCours ? "opacity-60" : ""}`}>
      <p className="truncate text-[12.5px] font-medium">
        {demande.reference ?? "Général"} · {demande.nom ?? "sans nom"}
      </p>
      <p className="text-[11px] text-dim">
        {dateFr(demande.created_at)} · {demande.source}
      </p>

      <select
        value={statut}
        disabled={enCours}
        aria-label={`Statut de la demande ${demande.reference ?? demande.id}`}
        className="champ mt-1.5 min-h-[34px] text-[11.5px]"
        onChange={(e) => {
          const suivant = e.target.value as DemandeStatut;
          const precedent = statut;
          setStatut(suivant);
          setErreur(false);
          demarrer(async () => {
            const r = await deplacerDemande(demande.id, suivant);
            if (!r.ok) {
              setStatut(precedent);
              setErreur(true);
              return;
            }
            // La carte doit rejoindre sa nouvelle colonne : seul le serveur
            // sait où elle va.
            router.refresh();
          });
        }}
      >
        {DEMANDE_STATUTS.map((x) => (
          <option key={x} value={x}>
            {LIBELLE_DEMANDE_STATUT[x]}
          </option>
        ))}
      </select>

      {erreur ? (
        <p role="alert" className="mt-1 text-[11px] text-vendu">
          Déplacement refusé — réessayez.
        </p>
      ) : null}
    </div>
  );
}
