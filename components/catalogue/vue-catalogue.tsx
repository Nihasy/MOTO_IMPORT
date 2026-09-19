"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { MotoAvecMedias } from "@/lib/types";
import { CATEGORIES, LIBELLE_CATEGORIE } from "@/lib/types";
import { lienRecherche } from "@/lib/whatsapp";
import { arCourt } from "@/lib/format";
import { pister } from "@/lib/analytics";
import { BarreSuperieure } from "@/components/ui/navigation";
import { useChromeVisible } from "@/components/ui/masquage-au-scroll";
import { EtatVide } from "@/components/ui";
import { CarteMoto } from "./carte-moto";
import { ICONE_CATEGORIE, IconeToutes } from "./icones-types";
import { FeuilleFiltres, type EtatFiltres } from "./feuille-filtres";
import { type MotoFiltrable, type Ordre } from "@/lib/db/filtres";
import { SelecteurTri } from "./selecteur-tri";

/** Étape 1 : l'acheteur tranche d'abord entre neuf et occasion, ou refuse de trancher. */
const ETATS_CHOIX = [
  { cle: "tous", libelle: "Tout" },
  { cle: "neuf", libelle: "Neuf" },
  { cle: "occasion", libelle: "Occasion" },
];

/** Étape 2 : le type, à la silhouette, dans l'ordre d'usage du catalogue. */
const TYPES = [
  { cle: "toutes", libelle: "Toutes", icone: IconeToutes },
  ...CATEGORIES.map((c) => ({ cle: c, libelle: LIBELLE_CATEGORIE[c], icone: ICONE_CATEGORIE[c] })),
];

export function VueCatalogue({
  motos,
  marques,
  annees,
  catalogue,
}: {
  motos: MotoAvecMedias[];
  marques: { nom: string; effectif: number }[];
  /** Annees presentes au catalogue, de la plus recente a la plus ancienne. */
  annees: number[];
  /** Catalogue complet allege : sert au comptage en direct dans la feuille. */
  catalogue: MotoFiltrable[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const chromeVisible = useChromeVisible();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  const filtres: EtatFiltres = useMemo(
    () => ({
      min: params.get("min") ? Number(params.get("min")) : undefined,
      max: params.get("max") ? Number(params.get("max")) : undefined,
      marques: params.get("marque")?.split(",").filter(Boolean) ?? [],
      cc: params.get("cc")?.split(",").filter(Boolean) ?? [],
      anneeMin: params.get("annee_min") ? Number(params.get("annee_min")) : undefined,
      anneeMax: params.get("annee_max") ? Number(params.get("annee_max")) : undefined,
      masquerVendues: params.get("masquer_vendues") === "1",
    }),
    [params]
  );

  const etatActif = params.get("etat") ?? "tous";
  const typeActif = params.get("cat") ?? "toutes";
  const recherche = params.get("q") ?? "";
  const tri = params.get("tri") ?? "date";
  const ordre: Ordre = params.get("ordre") === "asc" ? "asc" : "desc";

  const nbFiltresActifs =
    (filtres.min || filtres.max ? 1 : 0) +
    (filtres.marques.length ? 1 : 0) +
    (filtres.cc.length ? 1 : 0) +
    (filtres.anneeMin || filtres.anneeMax ? 1 : 0) +
    (filtres.masquerVendues ? 1 : 0);

  /** Les filtres vivent dans l'URL : un lien partagé les restitue (9.2). */
  const naviguer = useCallback(
    (maj: Record<string, string | undefined>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(maj)) {
        if (v === undefined || v === "") p.delete(k);
        else p.set(k, v);
      }
      const qs = p.toString();
      router.push(qs ? `/motos?${qs}` : "/motos", { scroll: false });
    },
    [params, router]
  );

  /**
   * Rappel des filtres en vigueur, chacun retirable d'un geste : sans cela,
   * il faut rouvrir la feuille pour comprendre pourquoi la liste est courte.
   */
  const puces: { cle: string; libelle: string; retirer: () => void }[] = [];
  if (recherche) puces.push({ cle: "q", libelle: `« ${recherche} »`, retirer: () => naviguer({ q: undefined }) });
  if (filtres.min || filtres.max) {
    const l =
      filtres.min && filtres.max
        ? `${arCourt(filtres.min)} – ${arCourt(filtres.max)}`
        : filtres.max
          ? `≤ ${arCourt(filtres.max)}`
          : `≥ ${arCourt(filtres.min!)}`;
    puces.push({ cle: "budget", libelle: l, retirer: () => naviguer({ min: undefined, max: undefined }) });
  }
  for (const m of filtres.marques) {
    puces.push({
      cle: `marque-${m}`,
      libelle: m,
      retirer: () => {
        const reste = filtres.marques.filter((x) => x !== m);
        naviguer({ marque: reste.length ? reste.join(",") : undefined });
      },
    });
  }
  for (const c of filtres.cc) {
    puces.push({
      cle: `cc-${c}`,
      libelle: `${c} cm³`,
      retirer: () => {
        const reste = filtres.cc.filter((x) => x !== c);
        naviguer({ cc: reste.length ? reste.join(",") : undefined });
      },
    });
  }
  if (filtres.anneeMin || filtres.anneeMax) {
    const l =
      filtres.anneeMin && filtres.anneeMax
        ? `${filtres.anneeMin} – ${filtres.anneeMax}`
        : filtres.anneeMax
          ? `≤ ${filtres.anneeMax}`
          : `≥ ${filtres.anneeMin}`;
    puces.push({
      cle: "annee",
      libelle: l,
      retirer: () => naviguer({ annee_min: undefined, annee_max: undefined }),
    });
  }
  if (filtres.masquerVendues)
    puces.push({
      cle: "vendues",
      libelle: "Vendues masquées",
      retirer: () => naviguer({ masquer_vendues: undefined }),
    });

  /** État et type se cumulent : « occasion » puis « trail » restreint deux fois. */
  const choisirEtat = (cle: string) => {
    pister("filtre_applique", { etat: cle });
    naviguer({ etat: cle === "tous" ? undefined : cle });
  };

  const choisirType = (cle: string) => {
    pister("filtre_applique", { type: cle });
    naviguer({ cat: cle === "toutes" ? undefined : cle });
  };

  const appliquer = (v: EtatFiltres) => {
    pister("filtre_applique", { source: "feuille" });
    naviguer({
      min: v.min ? String(v.min) : undefined,
      max: v.max ? String(v.max) : undefined,
      marque: v.marques.length ? v.marques.join(",") : undefined,
      cc: v.cc.length ? v.cc.join(",") : undefined,
      annee_min: v.anneeMin ? String(v.anneeMin) : undefined,
      annee_max: v.anneeMax ? String(v.anneeMax) : undefined,
      masquer_vendues: v.masquerVendues ? "1" : undefined,
    });
  };

  return (
    <>
      <BarreSuperieure
        filtresActifs={nbFiltresActifs}
        onOuvrirFiltres={() => setFeuilleOuverte(true)}
        onOuvrirRecherche={() => setRechercheOuverte((v) => !v)}
      />

      {rechercheOuverte ? (
        <div className="border-b border-line bg-surface px-4 py-3">
          <form
            className="conteneur-large flex gap-2 px-0"
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get("q");
              naviguer({ q: typeof v === "string" && v.trim() ? v.trim() : undefined });
            }}
          >
            <input
              name="q"
              defaultValue={recherche}
              placeholder="Marque ou modèle : Honda, CB500X…"
              className="champ"
              autoFocus
              aria-label="Recherche par marque ou modèle"
            />
            <button type="submit" className="btn-or px-5">
              OK
            </button>
          </form>
        </div>
      ) : null}

      {/* Collee a 56 px, c'est-a-dire sous l'en-tete. Quand celui-ci
          s'escamote, elle remonte d'autant pour venir se coller au bord :
          la laisser en place ouvrirait une bande transparente au sommet.
          Elle reste visible, elle, parce qu'elle porte le compte de
          resultats et le tri, utiles pendant tout le defilement. */}
      <div
        className={clsx(
          "sticky top-14 z-30 border-b border-line bg-bg/92 backdrop-blur lg:top-16",
          "transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
          !chromeVisible && "-translate-y-14 lg:-translate-y-16"
        )}
      >
        {/* Sur ordinateur, les deux etapes du choix tiennent sur une ligne :
            etire sur 1200px, le selecteur segmente devenait une barre vide. */}
        <div className="conteneur-large py-3 lg:flex lg:items-center lg:gap-5">
          <div
            role="group"
            aria-label="Neuf, occasion ou tout le catalogue"
            className="grid grid-cols-3 gap-1 rounded-card border border-line bg-surface p-1 lg:w-[340px] lg:shrink-0"
          >
            {ETATS_CHOIX.map((e) => (
              <button
                type="button"
                key={e.cle}
                onClick={() => choisirEtat(e.cle)}
                aria-pressed={etatActif === e.cle}
                className={clsx("segment", etatActif === e.cle && "segment-actif")}
              >
                {e.libelle}
              </button>
            ))}
          </div>

          <div className="relative mt-2.5 lg:mt-0 lg:min-w-0 lg:flex-1">
            <div role="group" aria-label="Type de moto" className="defilement-x gap-2 pb-0.5">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t.cle}
                  onClick={() => choisirType(t.cle)}
                  aria-pressed={typeActif === t.cle}
                  className={clsx("tuile-type", typeActif === t.cle && "tuile-type-active")}
                >
                  {t.icone}
                  <span className="truncate">{t.libelle}</span>
                </button>
              ))}
            </div>
            {/* La rangée déborde : un fondu vaut mieux qu'une flèche sur mobile. */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent"
              aria-hidden
            />
          </div>
        </div>
      </div>

      <main className="conteneur-large pb-28 pt-4">
        {/* Barre de resultats. Sur mobile la colonne est etroite : compte et tri
            s'empilent au centre plutot que de se disputer la largeur. Des la
            rangee, on revient au compte a gauche et au tri a droite. */}
        <div className="mb-3 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-between sm:gap-3">
          {/* Le compteur ne rappelle plus le delai d'importation : la liste
              melange des motos a commander et des motos deja sur place, et un
              « 45 a 65 jours » pose au-dessus de tout contredisait les fiches
              « disponible de suite ». Le delai reste sur chaque carte, ou il
              correspond bien au vehicule qu'il annonce. */}
          <p className="text-meta text-chrome">
            <strong className="font-semibold text-text">
              {motos.length} moto{motos.length > 1 ? "s" : ""}
            </strong>
          </p>

          <SelecteurTri
            tri={tri}
            ordre={ordre}
            onChanger={({ tri: t, ordre: o }) =>
              naviguer({
                ...(t !== undefined ? { tri: t === "date" ? undefined : t } : {}),
                ...(o !== undefined ? { ordre: o === "desc" ? undefined : o } : {}),
              })
            }
          />
        </div>

        {puces.length ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {puces.map((p) => (
              <button
                type="button"
                key={p.cle}
                onClick={p.retirer}
                className="puce gap-1.5 border-gold/60 text-text"
                aria-label={`Retirer le filtre ${p.libelle}`}
              >
                {p.libelle}
                <span aria-hidden className="text-dim">
                  ✕
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => router.push("/motos", { scroll: false })}
              className="text-meta text-gold-light underline"
            >
              Tout effacer
            </button>
          </div>
        ) : null}

        {motos.length ? (
          <div className="grille-annonces">
            {motos.map((m) => (
              <CarteMoto key={m.id} moto={m} />
            ))}
          </div>
        ) : (
          <EtatVide
            titre="Aucune moto ne correspond"
            texte="Dites-nous ce que vous cherchez : nous sourçons sur commande auprès de nos ateliers partenaires en Chine."
            action={{ libelle: "Dites-nous ce que vous cherchez", href: lienRecherche(filtres.max) }}
          />
        )}
      </main>

      <FeuilleFiltres
        ouverte={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        valeurs={filtres}
        marquesDisponibles={marques}
        annees={annees}
        catalogue={catalogue}
        onValider={appliquer}
        onReinitialiser={() => router.push("/motos", { scroll: false })}
      />
    </>
  );
}
