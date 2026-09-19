"use client";

import { useState } from "react";
import type { Moto } from "@/lib/types";
import { LIBELLE_STATUT } from "@/lib/types";
import { ar } from "@/lib/format";
import { calculerPrix, prixDynamique, type Reglages } from "@/lib/tarification";
import { montantAcompte, pourcent } from "@/lib/conditions";
import { ChampMontant } from "@/components/admin/champ-montant";

/**
 * Prix d'une fiche au back-office. Le prix de vente ne se saisit pas : il se
 * calcule depuis le prix d'achat en yuan (lib/tarification.ts) et s'affiche
 * ici en direct. Le serveur refait le calcul à l'enregistrement : ce qui est
 * montré n'est qu'un aperçu, jamais une valeur envoyée.
 *
 * - administrateur : saisit le prix en yuan, voit le détail (interne) ;
 * - éditeur : ne voit ni le yuan ni la marge, seulement le prix public ;
 * - prix figé (réservé, vendu, au local) : rien ne se saisit.
 */
export function BlocPrixAchat({
  moto,
  reglages,
  valeurReprise,
  enErreur,
}: {
  moto?: Moto;
  /** Réglages en vigueur : fournis au seul compte administrateur. */
  reglages: Reglages | null;
  valeurReprise?: string;
  enErreur?: boolean;
}) {
  const [yuan, setYuan] = useState<number | null>(
    valeurReprise ? Number(valeurReprise) || null : (moto?.prix_yuan ?? null)
  );
  const fige = moto ? !prixDynamique(moto.statut) : false;

  if (!reglages) {
    return (
      <div className="rounded-card border border-line bg-surface-hi px-3 py-3 text-corps">
        <p className="text-meta text-dim">Prix de vente</p>
        {moto && moto.prix_ttc > 0 ? (
          <p className="mt-0.5 font-semibold">
            {ar(moto.prix_ttc)}
            {moto.acompte_pct ? <span className="font-normal text-chrome"> · acompte {pourcent(moto.acompte_pct)}</span> : null}
          </p>
        ) : (
          <p className="mt-0.5 text-chrome">À fixer par l&apos;administrateur, à partir du prix d&apos;achat.</p>
        )}
      </div>
    );
  }

  if (fige && moto) {
    return (
      <div className="rounded-card border border-line bg-surface-hi px-3 py-3 text-corps">
        <p className="text-meta text-dim">
          Prix figé — statut « {LIBELLE_STATUT[moto.statut]} ». Il ne suit plus le taux du yuan.
        </p>
        <p className="mt-1 font-semibold">
          {ar(moto.prix_ttc)}
          {moto.acompte_pct ? <span className="font-normal text-chrome"> · acompte {pourcent(moto.acompte_pct)}</span> : null}
        </p>
        {moto.prix_yuan ? (
          <p className="mt-1 text-meta text-dim">
            Achat : {moto.prix_yuan.toLocaleString("fr-FR")} ¥ au taux de {moto.taux_yuan} Ar
          </p>
        ) : null}
        <p className="mt-2 text-meta text-dim">
          Pour corriger le prix d&apos;achat, repassez d&apos;abord la moto en « Disponible sur commande ».
        </p>
      </div>
    );
  }

  const c = yuan ? calculerPrix(yuan, reglages) : null;

  return (
    <div className="space-y-3">
      <div>
        <label className="etiquette" htmlFor="prix_yuan">
          Prix d&apos;achat (¥) <span className="text-dim">— interne, jamais affiché au public</span>
        </label>
        <ChampMontant
          id="prix_yuan"
          name="prix_yuan"
          defaultValue={yuan}
          suffixe="¥"
          placeholder="15 000"
          onValeur={setYuan}
          className={enErreur ? "border-vendu" : undefined}
        />
        <p className="mt-1 text-meta text-dim">
          Taux en vigueur : 1 ¥ = {reglages.taux_yuan.toLocaleString("fr-FR")} Ar. Le prix de vente
          et l&apos;acompte en découlent, et suivent le taux jusqu&apos;à la réservation.
        </p>
      </div>

      {c ? (
        <div className="overflow-hidden rounded-card border border-line">
          <div className="bg-surface-hi px-3.5 py-3">
            <p className="text-meta text-dim">Prix de vente affiché</p>
            <p className="text-[22px] font-extrabold leading-tight text-gold-light tabular-nums">{ar(c.prix_ar)}</p>
            <p className="mt-1 text-meta text-chrome tabular-nums">
              Acompte {pourcent(c.acompte_pct)} · {ar(montantAcompte(c.prix_ar, c.acompte_pct))} — solde{" "}
              {ar(c.solde_ar)} à la remise des clés
            </p>
          </div>
          <dl className="divide-y divide-line text-meta tabular-nums">
            {[
              ["Achat", `${ar(c.achat_ar)}`],
              ["Fret et papiers", ar(reglages.fret_ar)],
              ["Coût de revient", ar(c.cout_ar)],
              ["Bénéfice", ar(c.benefice_ar)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 bg-surface px-3.5 py-2">
                <dt className="text-dim">{k}</dt>
                <dd className={k === "Bénéfice" ? "font-semibold text-dispo" : "text-chrome"}>{v}</dd>
              </div>
            ))}
          </dl>
          {c.capital_avance_ar > 0 ? (
            <p className="border-t border-gold/40 bg-gold/10 px-3.5 py-2 text-meta text-gold-light">
              Acompte plafonné à {pourcent(c.acompte_pct)} par les CGV : vous avancez{" "}
              {ar(c.capital_avance_ar)} sur l&apos;achat.
            </p>
          ) : null}
          {!c.solde_couvre_fret ? (
            <p className="border-t border-gold/40 bg-gold/10 px-3.5 py-2 text-meta text-gold-light">
              Le solde ne couvre pas le fret et les papiers payés à l&apos;arrivée.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-card border border-line bg-surface-hi px-3 py-2.5 text-meta text-chrome">
          Sans prix d&apos;achat, la fiche reste en brouillon : elle ne peut pas être mise en vente.
        </p>
      )}
    </div>
  );
}
