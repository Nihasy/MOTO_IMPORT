import { ar, dateFr } from "@/lib/format";
import type { MotoPublique } from "@/lib/types";
import { montantAcompte, pourcent } from "@/lib/conditions";

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
            Prix valable jusqu&apos;au {dateFr(moto.prix_valable_jusqu_au)} · bon de commande signé au
            local.
          </p>
          {/* Acompte propre à la moto (CGV art. 4.2) : il couvre l'achat chez
              le partenaire, d'où un pourcentage qui dépend du prix. Le montant
              est donné en ariary pour que le client sache ce qu'il apporte. */}
          {vendu ? null : moto.acompte_pct ? (
            <dl className="mt-3 grid grid-cols-2 overflow-hidden rounded-card border border-line text-meta">
              <div className="bg-surface px-3 py-2.5">
                <dt className="text-dim">À la commande</dt>
                <dd className="mt-0.5 font-semibold text-text">
                  {pourcent(moto.acompte_pct)} · {ar(montantAcompte(moto.prix_ttc, moto.acompte_pct))}
                </dd>
              </div>
              <div className="border-l border-line bg-surface px-3 py-2.5">
                <dt className="text-dim">À la remise des clés</dt>
                <dd className="mt-0.5 font-semibold text-text">
                  {pourcent(100 - moto.acompte_pct)} ·{" "}
                  {ar(moto.prix_ttc - montantAcompte(moto.prix_ttc, moto.acompte_pct))}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 text-meta text-dim">
              Acompte indiqué au bon de commande, solde à la remise des clés et des papiers.
            </p>
          )}
        </>
      )}
    </div>
  );
}
