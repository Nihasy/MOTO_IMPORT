"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { publierBrouillonsPrets, type EtatPublicationMasse } from "@/app/admin/actions";

function Bouton({ prets }: { prets: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-or px-5" disabled={pending || prets === 0}>
      {pending ? "Publication…" : `Publier ${prets > 1 ? `les ${prets} brouillons prêts` : "le brouillon prêt"}`}
    </button>
  );
}

/**
 * Dernière étape du parcours d'import : CSV → brouillons → photos → vente.
 * Publie en une fois les brouillons dont tous les contrôles sont verts ; les
 * autres restent en brouillon, avec leurs points à compléter sur leur fiche.
 */
export function PublicationMasse({ prets, incomplets }: { prets: number; incomplets: number }) {
  const [etat, action] = useActionState<EtatPublicationMasse, FormData>(publierBrouillonsPrets, null);

  return (
    <section className="carte mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-gold-light">Brouillons à publier</h2>
        {etat?.publiees ? (
          <p role="status" className="mt-1 text-corps text-text">
            {etat.publiees.length
              ? `${etat.publiees.length} moto${etat.publiees.length > 1 ? "s" : ""} en vente : ${etat.publiees.join(", ")}.`
              : "Aucune fiche n'était prête."}
            {etat.retenues ? ` ${etat.retenues} restent en brouillon.` : ""}
          </p>
        ) : (
          <p className="mt-1 text-corps text-chrome">
            {prets
              ? `${prets} prêt${prets > 1 ? "s" : ""} à publier : photos, prix d'achat et description en place.`
              : "Aucun brouillon n'est encore prêt."}
            {incomplets ? (
              <>
                {" "}
                {incomplets} à compléter —{" "}
                <Link href="/admin/motos?statut=brouillon" className="text-gold-light underline">
                  voir ce qui manque
                </Link>
                .
              </>
            ) : null}
          </p>
        )}
      </div>
      <form action={action}>
        <Bouton prets={etat?.publiees ? 0 : prets} />
      </form>
    </section>
  );
}
