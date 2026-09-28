"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demarrerNavigation } from "@/components/ui/navigation-en-cours";
import clsx from "clsx";
import type { MotoAvecMedias } from "@/lib/types";
import { CATEGORIES, LIBELLE_CATEGORIE } from "@/lib/types";
import { lienRecherche } from "@/lib/whatsapp";
import { useWhatsapp } from "@/components/ui/contexte-contact";
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
import { CARTES_PAR_TRANCHE } from "@/lib/catalogue";

/**
 * Liste chargee et position, gardees le temps d'aller voir une fiche. Au
 * retour, la page ne rapporte que la premiere tranche : sans ce memo,
 * l'acheteur qui comparait la 40e moto se retrouvait vers la 20e.
 */
const CLE_RETOUR = "mi_catalogue_retour";
/** Au-dela, prix et statuts ont pu changer : mieux vaut repartir du haut. */
const RETOUR_VALIDE_MS = 30 * 60_000;

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
  total,
  marques,
  annees,
  catalogue,
}: {
  /** Premiere tranche du catalogue filtre ; la suite arrive au defilement. */
  motos: MotoAvecMedias[];
  /** Nombre de motos correspondant aux filtres, toutes tranches confondues. */
  total: number;
  marques: { nom: string; effectif: number }[];
  /** Annees presentes au catalogue, de la plus recente a la plus ancienne. */
  annees: number[];
  /** Catalogue complet allege : sert au comptage en direct dans la feuille. */
  catalogue: MotoFiltrable[];
}) {
  const whatsapp = useWhatsapp();
  const router = useRouter();
  const params = useSearchParams();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const chromeVisible = useChromeVisible();
  const [rechercheOuverte, setRechercheOuverte] = useState(false);

  // Tranches ajoutees au defilement, rattachees aux filtres qui les ont
  // demandees : changer de filtre repart de la premiere tranche que la page
  // apporte, sans laisser trainer les cartes de la recherche precedente.
  const cleListe = params.toString();
  const [suite, setSuite] = useState<{ cle: string; motos: MotoAvecMedias[] }>({ cle: cleListe, motos: [] });
  const [chargement, setChargement] = useState(false);
  const [echec, setEchec] = useState(false);
  const enVol = useRef(false);
  const sentinelle = useRef<HTMLDivElement>(null);
  const positionRetour = useRef<number | null>(null);

  // Retour d'une fiche : les cartes deja chargees reviennent avant que l'ecran
  // se peigne, puis la position suit une fois la liste a sa hauteur.
  useLayoutEffect(() => {
    let memo: { cle: string; motos: MotoAvecMedias[]; y: number; t: number } | null = null;
    try {
      memo = JSON.parse(sessionStorage.getItem(CLE_RETOUR) ?? "null");
      sessionStorage.removeItem(CLE_RETOUR);
    } catch {
      return;
    }
    if (!memo || memo.cle !== cleListe || Date.now() - memo.t > RETOUR_VALIDE_MS) return;
    positionRetour.current = memo.y;
    setSuite({ cle: memo.cle, motos: memo.motos });
    // Montage seulement : le memo ne vaut que pour l'arrivee sur la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    if (positionRetour.current === null) return;
    window.scrollTo(0, positionRetour.current);
    positionRetour.current = null;
  }, [suite]);

  const memoriserPosition = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('a[href^="/motos/"]')) return;
    try {
      sessionStorage.setItem(
        CLE_RETOUR,
        JSON.stringify({
          cle: cleListe,
          motos: suite.cle === cleListe ? suite.motos : [],
          y: window.scrollY,
          t: Date.now(),
        })
      );
    } catch {
      // Stockage plein ou refuse (navigation privee) : le retour repartira du haut.
    }
  };

  const affichees = useMemo(() => {
    const ajoutees = suite.cle === cleListe ? suite.motos : [];
    const vues = new Set(motos.map((m) => m.id));
    // Une moto publiee entre deux tranches decale la liste d'un cran : sans
    // ce tri, la derniere carte d'une tranche reapparaitrait dans la suivante.
    return [...motos, ...ajoutees.filter((m) => !vues.has(m.id))];
  }, [motos, suite, cleListe]);
  const reste = total - affichees.length;

  const chargerSuite = useCallback(async () => {
    if (enVol.current || reste <= 0) return;
    enVol.current = true;
    setChargement(true);
    setEchec(false);
    const q = new URLSearchParams(cleListe);
    q.set("depuis", String(affichees.length));
    try {
      const r = await fetch(`/api/catalogue?${q}`);
      if (!r.ok) throw new Error(String(r.status));
      const { motos: tranche } = (await r.json()) as { motos: MotoAvecMedias[] };
      setSuite((s) => {
        const deja = s.cle === cleListe ? s.motos : [];
        const connues = new Set([...motos, ...deja].map((m) => m.id));
        return { cle: cleListe, motos: [...deja, ...tranche.filter((m) => !connues.has(m.id))] };
      });
    } catch {
      // Reseau mobile coupe : le bouton reste, un toucher relance la demande.
      setEchec(true);
    } finally {
      enVol.current = false;
      setChargement(false);
    }
  }, [reste, cleListe, affichees.length, motos]);

  // La tranche suivante est demandee bien avant le bas de la liste : l'acheteur
  // qui fait defiler ne doit pas buter sur une attente. L'observateur est
  // recree a chaque tranche, pour relancer si la sentinelle est encore visible.
  useEffect(() => {
    const el = sentinelle.current;
    if (!el || reste <= 0 || echec || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) void chargerSuite();
      },
      { rootMargin: "0px 0px 1200px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [chargerSuite, reste, echec]);

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
      demarrerNavigation();
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
              « 45 a 75 jours » pose au-dessus de tout contredisait les fiches
              « disponible de suite ». Le delai reste sur chaque carte, ou il
              correspond bien au vehicule qu'il annonce. */}
          <p className="text-meta text-chrome">
            <strong className="font-semibold text-text">
              {total} moto{total > 1 ? "s" : ""}
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
              onClick={() => {
                demarrerNavigation();
                router.push("/motos", { scroll: false });
              }}
              className="text-meta text-gold-light underline"
            >
              Tout effacer
            </button>
          </div>
        ) : null}

        {affichees.length ? (
          <>
            <div className="grille-annonces" onClickCapture={memoriserPosition}>
              {affichees.map((m, i) => (
                // Trois cartes couvrent le premier écran, trois colonnes comprises.
                <CarteMoto key={m.id} moto={m} prioritaire={i < 3} />
              ))}
            </div>
            {reste > 0 ? (
              <div ref={sentinelle} className="mt-6 flex flex-col items-center gap-2">
                {/* Le bouton double le chargement automatique : il reste la voie
                    quand l'observateur manque ou que le reseau a lache. */}
                <button
                  type="button"
                  onClick={() => void chargerSuite()}
                  disabled={chargement}
                  className="btn-fantome"
                >
                  {chargement ? "Chargement…" : `Voir les ${Math.min(reste, CARTES_PAR_TRANCHE)} suivantes`}
                </button>
                {echec ? <p className="text-meta text-dim">Connexion interrompue. Touchez pour réessayer.</p> : null}
              </div>
            ) : null}
          </>
        ) : (
          <EtatVide
            titre="Aucune moto ne correspond"
            texte="Dites-nous ce que vous cherchez : nous sourçons sur commande auprès de nos ateliers partenaires en Chine."
            action={{ libelle: "Dites-nous ce que vous cherchez", href: lienRecherche(filtres.max, whatsapp) }}
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
        onReinitialiser={() => {
          demarrerNavigation();
          router.push("/motos", { scroll: false });
        }}
      />
    </>
  );
}
