"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { arCourt } from "@/lib/format";
import { fusionnerMarques } from "@/lib/marques";
import { TRANCHES_CC, appliquerFiltres, type MotoFiltrable } from "@/lib/db/filtres";

export type EtatFiltres = {
  min?: number;
  max?: number;
  marques: string[];
  cc: string[];
  anneeMin?: number;
  anneeMax?: number;
  masquerVendues: boolean;
};

/**
 * Echelle de budget, en Ariary, de 0 a 500 millions. La jauge se deplace d'un
 * cran de cette echelle, pas d'un Ariary : le pas se resserre la ou se joue la
 * decision — un million d'ecart compte a 8 M, plus a 300 M.
 */
const ECHELLE_BUDGET = [
  0,
  ...suite(1_000_000, 20_000_000, 1_000_000),
  ...suite(25_000_000, 100_000_000, 5_000_000),
  ...suite(125_000_000, 500_000_000, 25_000_000),
];
const DERNIER_CRAN = ECHELLE_BUDGET.length - 1;

/** Position d'une borne sur l'echelle ; les extremes valent « sans limite ». */
function cranDepuisValeur(v: number | undefined, defaut: number): number {
  if (v === undefined) return defaut;
  const i = ECHELLE_BUDGET.findIndex((p) => p >= v);
  return i === -1 ? DERNIER_CRAN : i;
}

/**
 * Echelle des millesimes, un cran par annee de 1800 a 2026. Les deux extremes
 * ne contraignent rien : une borne basse a 1800 ou haute a 2026 laisse passer
 * tout le catalogue, autant les traiter comme l'absence de filtre.
 */
const ANNEE_MIN = 1800;
const ANNEE_MAX = 2026;
const DERNIER_CRAN_ANNEE = ANNEE_MAX - ANNEE_MIN;

function suite(de: number, a: number, pas: number): number[] {
  const out: number[] = [];
  for (let v = de; v <= a; v += pas) out.push(v);
  return out;
}

/** Section repliable : l'en-tete resume la selection, le corps la modifie. */
function SectionFiltre({
  titre,
  resume,
  actif,
  ouverteParDefaut = false,
  children,
}: {
  titre: string;
  resume: string;
  actif: boolean;
  ouverteParDefaut?: boolean;
  children: React.ReactNode;
}) {
  const [ouverte, setOuverte] = useState(ouverteParDefaut);
  return (
    <section className="border-b border-line">
      <h3>
        <button
          type="button"
          onClick={() => setOuverte((v) => !v)}
          aria-expanded={ouverte}
          className="flex w-full items-center justify-between gap-3 py-3 text-left"
        >
          <span className="text-[15px] font-semibold">{titre}</span>
          <span className="flex items-center gap-2">
            <span className={clsx("text-meta", actif ? "font-semibold text-gold-light" : "text-dim")}>
              {resume}
            </span>
            <Chevron ouvert={ouverte} />
          </span>
        </button>
      </h3>
      {ouverte ? <div className="pb-4">{children}</div> : null}
    </section>
  );
}

function Chevron({ ouvert }: { ouvert: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("shrink-0 text-dim transition-transform", ouvert && "rotate-180")}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Jauge a deux poignees, tirees de gauche a droite sur un meme rail. La bande
 * doree entre les deux montre la tranche retenue. Les poignees se deplacent
 * d'un cran d'echelle, jamais d'une unite brute : c'est l'appelant qui decide
 * ce que vaut un cran, et comment il s'ecrit.
 *
 * Les deux boutons de chaque borne servent au reglage fin — au doigt, sur deux
 * cents crans, viser l'annee exacte a la poignee seule est illusoire.
 */
function JaugeIntervalle({
  cranMin,
  cranMax,
  dernier,
  libelle,
  bornes,
  etiquettes,
  onChange,
}: {
  cranMin: number;
  cranMax: number;
  dernier: number;
  libelle: (cran: number, borne: "min" | "max") => string;
  /** Reperes sous les extremites du rail. */
  bornes: [string, string];
  /** Intitules accessibles des deux poignees. */
  etiquettes: [string, string];
  onChange: (min: number, max: number) => void;
}) {
  const pct = (c: number) => (c / dernier) * 100;
  const poserMin = (c: number) => onChange(Math.max(0, Math.min(c, cranMax - 1)), cranMax);
  const poserMax = (c: number) => onChange(cranMin, Math.min(dernier, Math.max(c, cranMin + 1)));

  return (
    <div>
      <div className="mb-3 space-y-1.5">
        <LigneBorne
          titre="Minimum"
          valeur={libelle(cranMin, "min")}
          onMoins={() => poserMin(cranMin - 1)}
          onPlus={() => poserMin(cranMin + 1)}
          moinsInactif={cranMin <= 0}
          plusInactif={cranMin >= cranMax - 1}
        />
        <LigneBorne
          titre="Maximum"
          valeur={libelle(cranMax, "max")}
          onMoins={() => poserMax(cranMax - 1)}
          onPlus={() => poserMax(cranMax + 1)}
          moinsInactif={cranMax <= cranMin + 1}
          plusInactif={cranMax >= dernier}
        />
      </div>

      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-surface-hi" aria-hidden />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 bg-gold"
          style={{ left: `${pct(cranMin)}%`, right: `${100 - pct(cranMax)}%` }}
          aria-hidden
        />
        {/* La poignee basse passe devant quand les deux se rejoignent, sinon
            elle resterait coincee sous l'autre au bout du rail. */}
        <input
          type="range"
          min={0}
          max={dernier}
          step={1}
          value={cranMin}
          onChange={(e) => poserMin(Number(e.target.value))}
          className={clsx("jauge", cranMin > dernier - 2 ? "z-20" : "z-10")}
          aria-label={etiquettes[0]}
          aria-valuetext={libelle(cranMin, "min")}
        />
        <input
          type="range"
          min={0}
          max={dernier}
          step={1}
          value={cranMax}
          onChange={(e) => poserMax(Number(e.target.value))}
          className="jauge z-10"
          aria-label={etiquettes[1]}
          aria-valuetext={libelle(cranMax, "max")}
        />
      </div>

      <div className="mt-1 flex justify-between text-meta text-dim">
        <span>{bornes[0]}</span>
        <span>{bornes[1]}</span>
      </div>
    </div>
  );
}

function LigneBorne({
  titre,
  valeur,
  onMoins,
  onPlus,
  moinsInactif,
  plusInactif,
}: {
  titre: string;
  valeur: string;
  onMoins: () => void;
  onPlus: () => void;
  moinsInactif: boolean;
  plusInactif: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[14px] font-medium text-chrome">{titre}</span>
      <span className="flex items-center gap-2">
        <BoutonPas signe="−" onClick={onMoins} inactif={moinsInactif} intitule={`${titre} : un cran en moins`} />
        <span className="min-w-[104px] text-center text-[16px] font-bold text-gold-light">{valeur}</span>
        <BoutonPas signe="+" onClick={onPlus} inactif={plusInactif} intitule={`${titre} : un cran en plus`} />
      </span>
    </div>
  );
}

function BoutonPas({
  signe,
  onClick,
  inactif,
  intitule,
}: {
  signe: string;
  onClick: () => void;
  inactif: boolean;
  intitule: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inactif}
      aria-label={intitule}
      className="flex h-8 w-8 shrink-0 items-center justify-center border border-line bg-surface-hi text-[16px] font-bold text-chrome transition-colors hover:border-gold hover:text-text disabled:opacity-35 disabled:hover:border-line disabled:hover:text-chrome"
    >
      {signe}
    </button>
  );
}

/** Liste a choix multiple, verticale : on coche plusieurs marques d'affilee. */
function ListeCases({
  titre,
  options,
  selection,
  onBasculer,
}: {
  titre: string;
  options: { valeur: string; libelle: string; note?: string }[];
  selection: string[];
  onBasculer: (v: string) => void;
}) {
  return (
    <div>
      <p className="etiquette">{titre}</p>
      <div className="max-h-64 overflow-y-auto border border-line bg-surface-hi">
        {options.length ? (
          options.map((o) => {
            const coche = selection.includes(o.valeur);
            return (
              <button
                type="button"
                key={o.valeur}
                onClick={() => onBasculer(o.valeur)}
                aria-pressed={coche}
                className={clsx(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[14px] transition-colors",
                  coche ? "bg-surface font-semibold text-text" : "text-chrome hover:bg-surface hover:text-text"
                )}
              >
                <Case cochee={coche} />
                <span className="flex-1 truncate">{o.libelle}</span>
                {o.note ? <span className="text-meta text-dim">{o.note}</span> : null}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-meta text-dim">Aucune marque à ce nom.</p>
        )}
      </div>
    </div>
  );
}

function Case({ cochee }: { cochee: boolean }) {
  return (
    <span
      className={clsx(
        "flex h-4 w-4 shrink-0 items-center justify-center border",
        cochee ? "border-gold bg-gold text-on-gold" : "border-line bg-bg"
      )}
      aria-hidden
    >
      {cochee ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </span>
  );
}

export function FeuilleFiltres({
  ouverte,
  onFermer,
  valeurs,
  marquesDisponibles,
  annees,
  catalogue,
  onValider,
  onReinitialiser,
}: {
  ouverte: boolean;
  onFermer: () => void;
  valeurs: EtatFiltres;
  marquesDisponibles: { nom: string; effectif: number }[];
  /** Annees ayant du stock : elles sont mises en avant dans le rouleau. */
  annees: number[];
  /** Catalogue complet allege, pour compter les resultats avant de valider. */
  catalogue: MotoFiltrable[];
  onValider: (v: EtatFiltres) => void;
  onReinitialiser: () => void;
}) {
  const [local, setLocal] = useState<EtatFiltres>(valeurs);
  const [chercheMarque, setChercheMarque] = useState("");

  useEffect(() => {
    if (ouverte) setLocal(valeurs);
  }, [ouverte, valeurs]);

  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = "";
    };
  }, [ouverte, onFermer]);

  const marques = useMemo(() => fusionnerMarques(marquesDisponibles), [marquesDisponibles]);

  // Compte les resultats a chaque reglage : le bouton de validation annonce ce
  // qu'on va trouver, et une combinaison vide se voit avant de fermer.
  const nbResultats = useMemo(
    () =>
      appliquerFiltres(catalogue, {
        prixMin: local.min,
        prixMax: local.max,
        marques: local.marques.length ? local.marques : undefined,
        cylindrees: local.cc.length ? local.cc : undefined,
        anneeMin: local.anneeMin,
        anneeMax: local.anneeMax,
        masquerVendues: local.masquerVendues,
      }).length,
    [catalogue, local]
  );

  if (!ouverte) return null;

  const basculerListe = (cle: "marques" | "cc", valeur: string) =>
    setLocal((v) => ({
      ...v,
      [cle]: v[cle].includes(valeur) ? v[cle].filter((x) => x !== valeur) : [...v[cle], valeur],
    }));

  const marquesFiltrees = marques.filter((m) =>
    m.nom.toLowerCase().includes(chercheMarque.toLowerCase().trim())
  );

  const resumeBudget =
    local.min && local.max
      ? `${arCourt(local.min)} – ${arCourt(local.max)}`
      : local.max
        ? `≤ ${arCourt(local.max)}`
        : local.min
          ? `≥ ${arCourt(local.min)}`
          : "Tous";

  const resumeAnnee =
    local.anneeMin && local.anneeMax
      ? local.anneeMin === local.anneeMax
        ? String(local.anneeMin)
        : `${local.anneeMin} – ${local.anneeMax}`
      : local.anneeMax
        ? `≤ ${local.anneeMax}`
        : local.anneeMin
          ? `≥ ${local.anneeMin}`
          : "Toutes";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Filtres">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onFermer} aria-label="Fermer les filtres" />
      <div className="relative flex max-h-[88vh] w-full max-w-[680px] flex-col border-t border-line bg-surface sm:max-h-[86vh] sm:border-x">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[17px] font-bold">Affiner la recherche</h2>
          <button type="button" onClick={onFermer} className="min-h-touch px-2 text-meta text-dim hover:text-text" aria-label="Fermer">
            Fermer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <SectionFiltre titre="Budget" resume={resumeBudget} actif={!!(local.min || local.max)} ouverteParDefaut>
            <JaugeIntervalle
              cranMin={cranDepuisValeur(local.min, 0)}
              cranMax={cranDepuisValeur(local.max, DERNIER_CRAN)}
              dernier={DERNIER_CRAN}
              libelle={(c, borne) =>
                borne === "min"
                  ? c === 0
                    ? "0 Ar"
                    : arCourt(ECHELLE_BUDGET[c])
                  : c === DERNIER_CRAN
                    ? "Sans limite"
                    : arCourt(ECHELLE_BUDGET[c])
              }
              bornes={["0 Ar", "500 M Ar"]}
              etiquettes={["Budget minimum", "Budget maximum"]}
              onChange={(cMin, cMax) =>
                setLocal((s) => ({
                  ...s,
                  min: cMin === 0 ? undefined : ECHELLE_BUDGET[cMin],
                  max: cMax === DERNIER_CRAN ? undefined : ECHELLE_BUDGET[cMax],
                }))
              }
            />
          </SectionFiltre>

          <SectionFiltre
            titre="Marque"
            resume={local.marques.length ? `${local.marques.length} sélectionnée${local.marques.length > 1 ? "s" : ""}` : "Toutes"}
            actif={local.marques.length > 0}
            ouverteParDefaut={local.marques.length > 0}
          >
            <input
              type="search"
              value={chercheMarque}
              onChange={(e) => setChercheMarque(e.target.value)}
              placeholder="Chercher une marque"
              className="champ mb-2"
              aria-label="Chercher une marque"
            />
            <ListeCases
              titre={`${marques.length} marques — celles en stock d'abord`}
              options={marquesFiltrees.map((m) => ({
                valeur: m.nom,
                libelle: m.nom,
                note: m.effectif ? String(m.effectif) : undefined,
              }))}
              selection={local.marques}
              onBasculer={(v) => basculerListe("marques", v)}
            />
            {local.marques.length ? (
              <button
                type="button"
                onClick={() => setLocal((s) => ({ ...s, marques: [] }))}
                className="mt-2 text-meta text-gold-light underline"
              >
                Décocher les {local.marques.length} marques
              </button>
            ) : null}
          </SectionFiltre>

          <SectionFiltre
            titre="Cylindrée"
            resume={local.cc.length ? `${local.cc.length} tranche${local.cc.length > 1 ? "s" : ""}` : "Toutes"}
            actif={local.cc.length > 0}
            ouverteParDefaut={local.cc.length > 0}
          >
            <ListeCases
              titre="Tranches en cm³"
              options={Object.keys(TRANCHES_CC).map((t) => ({ valeur: t, libelle: `${t} cm³` }))}
              selection={local.cc}
              onBasculer={(v) => basculerListe("cc", v)}
            />
          </SectionFiltre>

          <SectionFiltre
            titre="Année"
            resume={resumeAnnee}
            actif={!!(local.anneeMin || local.anneeMax)}
            ouverteParDefaut={!!(local.anneeMin || local.anneeMax)}
          >
            <JaugeIntervalle
              cranMin={(local.anneeMin ?? ANNEE_MIN) - ANNEE_MIN}
              cranMax={(local.anneeMax ?? ANNEE_MAX) - ANNEE_MIN}
              dernier={DERNIER_CRAN_ANNEE}
              libelle={(c) => String(ANNEE_MIN + c)}
              bornes={[String(ANNEE_MIN), String(ANNEE_MAX)]}
              etiquettes={["Année minimum", "Année maximum"]}
              onChange={(cMin, cMax) =>
                setLocal((s) => ({
                  ...s,
                  anneeMin: cMin === 0 ? undefined : ANNEE_MIN + cMin,
                  anneeMax: cMax === DERNIER_CRAN_ANNEE ? undefined : ANNEE_MIN + cMax,
                }))
              }
            />
            {annees.length ? (
              <p className="mt-2 text-meta text-dim">
                Catalogue actuel : {Math.min(...annees)} à {Math.max(...annees)}.
              </p>
            ) : null}
          </SectionFiltre>

          <label className="flex min-h-touch items-center justify-between gap-4 py-2">
            <span className="text-[15px] font-semibold">Masquer les motos vendues</span>
            <input
              type="checkbox"
              checked={local.masquerVendues}
              onChange={(e) => setLocal((v) => ({ ...v, masquerVendues: e.target.checked }))}
              className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-surface-hi transition-colors checked:bg-gold relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-chrome before:transition-transform checked:before:translate-x-5 checked:before:bg-on-gold"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="btn-fantome"
            onClick={() => {
              onReinitialiser();
              onFermer();
            }}
          >
            Réinitialiser
          </button>
          <button
            type="button"
            className="btn-or"
            disabled={nbResultats === 0}
            onClick={() => {
              onValider(local);
              onFermer();
            }}
          >
            {nbResultats === 0
              ? "Aucun résultat"
              : `Voir ${nbResultats} moto${nbResultats > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
