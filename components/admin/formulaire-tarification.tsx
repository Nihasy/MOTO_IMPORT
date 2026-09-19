"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import type { Statut } from "@/lib/types";
import { LIBELLE_STATUT } from "@/lib/types";
import { ar } from "@/lib/format";
import { calculerPrix, erreurReglages, type Reglages } from "@/lib/tarification";
import { ACOMPTE_MAX, ACOMPTE_MIN, montantAcompte, pourcent } from "@/lib/conditions";
import { enregistrerTarification, type EtatTarification } from "@/app/admin/actions";
import { ChampMontant } from "@/components/admin/champ-montant";

export type MotoTarifee = {
  id: string;
  reference: string;
  nom: string;
  statut: Statut;
  prix_yuan: number;
  prix_ttc: number;
};

/** Au-delà de cet écart de taux, l'enregistrement demande une confirmation. */
const ECART_A_CONFIRMER = 0.15;

function Bouton({ nb, desactive }: { nb: number; desactive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-or w-full" disabled={pending || desactive}>
      {pending
        ? "Enregistrement…"
        : nb
          ? `Enregistrer et recalculer ${nb} prix`
          : "Enregistrer les réglages"}
    </button>
  );
}

export function FormulaireTarification({
  reglages,
  motos,
  verrouille,
}: {
  reglages: Reglages;
  motos: MotoTarifee[];
  verrouille: boolean;
}) {
  const [etat, action] = useActionState<EtatTarification, FormData>(enregistrerTarification, null);
  const [r, setR] = useState<Reglages>(reglages);
  const [simulation, setSimulation] = useState<number | null>(15_000);

  const maj = (cle: keyof Reglages) => (v: number | null) => setR((x) => ({ ...x, [cle]: v ?? NaN }));
  const invalide = erreurReglages(r);

  const apercu = useMemo(
    () =>
      invalide
        ? []
        : motos.map((m) => {
            const nouveau = calculerPrix(m.prix_yuan, r).prix_ar;
            return { ...m, nouveau, ecart: nouveau - m.prix_ttc };
          }),
    [motos, r, invalide]
  );
  const changees = apercu.filter((m) => m.ecart !== 0);
  const ecartTaux = Math.abs(r.taux_yuan - reglages.taux_yuan) / reglages.taux_yuan;
  const aConfirmer = Number.isFinite(ecartTaux) && ecartTaux > ECART_A_CONFIRMER;
  const sim = simulation && !invalide ? calculerPrix(simulation, r) : null;

  return (
    <form action={action} className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        {etat?.erreur ? (
          <p role="alert" className="rounded-card border border-vendu/60 bg-vendu/10 px-4 py-3 text-corps text-text">
            {etat.erreur}
          </p>
        ) : null}
        {etat && !etat.erreur ? (
          <p role="status" className="rounded-card border border-dispo/50 bg-dispo/10 px-4 py-3 text-corps text-text">
            Réglages enregistrés.{" "}
            {etat.recalculees
              ? `${etat.recalculees} prix recalculé${etat.recalculees > 1 ? "s" : ""} et en ligne.`
              : "Aucun prix n'avait à changer."}
          </p>
        ) : null}

        <fieldset className="carte space-y-3 p-4" disabled={verrouille}>
          <legend className="px-1 text-[12.5px] font-semibold text-gold-light">Change et coûts</legend>
          <Champ pour="taux_yuan" label="Taux du yuan" aide="1 ¥ = … Ar">
            <ChampMontant id="taux_yuan" name="taux_yuan" decimales suffixe="Ar" defaultValue={reglages.taux_yuan} onValeur={maj("taux_yuan")} required />
          </Champ>
          <Champ pour="fret_ar" label="Fret, dédouanement et papiers" aide="Fixe par moto, payé à l'arrivée à Tana">
            <ChampMontant id="fret_ar" name="fret_ar" suffixe="Ar" defaultValue={reglages.fret_ar} onValeur={maj("fret_ar")} required />
          </Champ>
        </fieldset>

        <fieldset className="carte space-y-3 p-4" disabled={verrouille}>
          <legend className="px-1 text-[12.5px] font-semibold text-gold-light">Bénéfice</legend>
          <Champ pour="benefice_fixe_ar" label="Bénéfice fixe par moto" aide="Gagné sur chaque moto, même la moins chère">
            <ChampMontant id="benefice_fixe_ar" name="benefice_fixe_ar" suffixe="Ar" defaultValue={reglages.benefice_fixe_ar} onValeur={maj("benefice_fixe_ar")} required />
          </Champ>
          <Champ pour="part_achat_pct" label="Part du prix d'achat" aide="Ajoutée au bénéfice fixe : le bénéfice grandit avec le prix de la moto">
            <ChampMontant id="part_achat_pct" name="part_achat_pct" decimales suffixe="%" defaultValue={reglages.part_achat_pct} onValeur={maj("part_achat_pct")} required />
          </Champ>
          <Champ pour="arrondi_ar" label="Arrondi du prix de vente" aide="Au palier supérieur : 18 562 350 Ar devient 18 600 000 Ar">
            <ChampMontant id="arrondi_ar" name="arrondi_ar" suffixe="Ar" defaultValue={reglages.arrondi_ar} onValeur={maj("arrondi_ar")} required />
          </Champ>
        </fieldset>

        <fieldset className="carte space-y-3 p-4" disabled={verrouille}>
          <legend className="px-1 text-[12.5px] font-semibold text-gold-light">Acompte</legend>
          <Champ pour="securite_change_pct" label="Sécurité sur le change" aide="L'acompte couvre l'achat, plus cette marge contre une hausse du yuan">
            <ChampMontant id="securite_change_pct" name="securite_change_pct" decimales suffixe="%" defaultValue={reglages.securite_change_pct} onValeur={maj("securite_change_pct")} required />
          </Champ>
          <p className="rounded-card border border-line bg-surface-hi px-3 py-2.5 text-meta text-chrome">
            Acompte compris entre {pourcent(ACOMPTE_MIN)} et {pourcent(ACOMPTE_MAX)}, arrondi au 5 %
            supérieur. Ces bornes sont fixées par les{" "}
            <Link href="/cgv" target="_blank" className="text-gold-light underline">CGV (art. 4.2)</Link> : les
            changer, c&apos;est changer le contrat.
          </p>
        </fieldset>

        {invalide ? (
          <p role="alert" className="rounded-card border border-vendu/60 bg-vendu/10 px-4 py-3 text-meta text-text">
            {invalide}
          </p>
        ) : null}

        {aConfirmer ? (
          <label className="flex items-start gap-3 rounded-card border border-gold/50 bg-gold/10 px-4 py-3 text-meta text-text">
            <input type="checkbox" name="confirmer" className="mt-0.5 h-5 w-5 shrink-0 accent-gold" />
            <span>
              Le taux passe de {reglages.taux_yuan.toLocaleString("fr-FR")} à{" "}
              {Number.isFinite(r.taux_yuan) ? r.taux_yuan.toLocaleString("fr-FR") : "—"} Ar, soit{" "}
              {Math.round(ecartTaux * 100)} % d&apos;écart. Je confirme que ce n&apos;est pas une faute
              de frappe.
            </span>
          </label>
        ) : null}

        <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
          <Bouton nb={changees.length} desactive={verrouille || Boolean(invalide)} />
        </div>
      </div>

      <div className="space-y-5">
        <section className="carte p-4">
          <h2 className="text-[15px] font-semibold text-gold-light">Simulateur</h2>
          <p className="mt-1 text-meta text-dim">Avec les réglages saisis, avant enregistrement. Rien n&apos;est écrit.</p>
          <div className="mt-3">
            <ChampMontant id="simulation" name="_simulation" suffixe="¥" defaultValue={simulation} onValeur={setSimulation} placeholder="15 000" />
          </div>
          {sim ? (
            <dl className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line text-meta tabular-nums">
              {[
                ["Achat", ar(sim.achat_ar)],
                ["Fret et papiers", ar(r.fret_ar)],
                ["Coût de revient", ar(sim.cout_ar)],
                ["Bénéfice", ar(sim.benefice_ar)],
                ["Prix de vente", ar(sim.prix_ar)],
                [`Acompte (${pourcent(sim.acompte_pct)})`, ar(montantAcompte(sim.prix_ar, sim.acompte_pct))],
                ["Solde à la remise des clés", ar(sim.solde_ar)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 bg-surface px-3.5 py-2">
                  <dt className="text-dim">{k}</dt>
                  <dd
                    className={clsx(
                      k === "Prix de vente" && "font-bold text-gold-light",
                      k === "Bénéfice" && "font-semibold text-dispo",
                      k !== "Prix de vente" && k !== "Bénéfice" && "text-chrome"
                    )}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {sim && sim.capital_avance_ar > 0 ? (
            <p className="mt-2 text-meta text-gold-light">
              Acompte plafonné : {ar(sim.capital_avance_ar)} d&apos;achat avancés de votre poche.
            </p>
          ) : null}
        </section>

        <section className="carte p-4">
          <h2 className="text-[15px] font-semibold text-gold-light">Effet sur les prix</h2>
          <p className="mt-1 text-meta text-dim">
            {motos.length
              ? `${motos.length} moto${motos.length > 1 ? "s" : ""} au prix dynamique (brouillon ou disponible sur commande). ${
                  changees.length ? `${changees.length} changerai${changees.length > 1 ? "ent" : "t"} de prix.` : "Aucun prix ne change."
                }`
              : "Aucune moto au prix dynamique pour l'instant."}
          </p>
          {changees.length ? (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line text-meta tabular-nums">
              {changees.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 bg-surface px-3.5 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold text-text">{m.reference}</span>{" "}
                    <span className="text-chrome">{m.nom}</span>{" "}
                    <span className="text-dim">· {LIBELLE_STATUT[m.statut]}</span>
                  </span>
                  <span className="whitespace-nowrap">
                    <span className="text-dim line-through">{m.prix_ttc > 0 ? ar(m.prix_ttc) : "sans prix"}</span>{" "}
                    → <span className="font-semibold text-text">{ar(m.nouveau)}</span>{" "}
                    <span className={m.ecart > 0 ? "text-gold-light" : "text-dispo"}>
                      ({m.ecart > 0 ? "+" : "−"}
                      {ar(Math.abs(m.ecart))})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </form>
  );
}

function Champ({ pour, label, aide, children }: { pour: string; label: string; aide: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="etiquette" htmlFor={pour}>{label}</label>
      {children}
      <p className="mt-1 text-meta text-dim">{aide}</p>
    </div>
  );
}
