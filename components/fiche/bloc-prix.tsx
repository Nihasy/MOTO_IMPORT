import { ar, dateFr } from "@/lib/format";
import type { MotoPublique } from "@/lib/types";
import { ACOMPTE_COMMANDE_TEXTE, SOLDE_LIVRAISON_TEXTE } from "@/lib/conditions";

/**
 * Élément signature du design system (8.4) : le prix traité comme un numéro
 * de course, isolé entre deux filets, suivi de la mention « rendu Tana ».
 */
export function BlocPrix({ moto }: { moto: MotoPublique }) {
  const vendu = moto.statut === "vendu";
  const surPlace = moto.statut === "dispo_immediate";
  return (
    <div className="my-6 border-y border-line py-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <span
          className={`text-prix-fiche leading-none ${
            vendu ? "text-dim line-through" : "text-gold-light"
          }`}
        >
          {ar(moto.prix_ttc)}
        </span>
        {vendu ? (
          <span className="rounded-card bg-vendu/20 px-2.5 py-1 text-badge font-semibold uppercase tracking-wide text-vendu">
            Vendu
          </span>
        ) : null}
      </div>
      {/* Le véhicule déjà sur place n'a plus de trajet devant lui : « rendu à
          Antananarivo » y décrit une livraison qui a eu lieu, et la date de
          validité du prix n'a plus d'objet — elle couvre la variation des
          droits d'importation (CGV art. 5.4), déjà acquittés ici. */}
      {surPlace ? (
        <>
          <p className="mt-2 text-corps text-chrome">
            Prix final, carte grise établie à votre nom, incluse. Véhicule déjà au local
            d&apos;Antananarivo.
          </p>
          <p className="mt-1 text-meta text-dim">
            Aucun délai d&apos;importation · bon de commande signé au local, remise des clés dès le
            solde réglé.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-corps text-chrome">
            Prix final, rendu à Antananarivo. Carte grise établie à votre nom, incluse.
          </p>
          <p className="mt-1 text-meta text-dim">
            Prix valable jusqu&apos;au {dateFr(moto.prix_valable_jusqu_au)} · Acompte de {ACOMPTE_COMMANDE_TEXTE} à la
            signature du bon de commande, au local · solde de {SOLDE_LIVRAISON_TEXTE} à la remise des
            clés et des papiers.
          </p>
        </>
      )}
    </div>
  );
}
