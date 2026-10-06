"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { arCourt } from "@/lib/format";
import { pister } from "@/lib/analytics";
import { lienRecherche } from "@/lib/whatsapp";
import { decouper, surligner } from "@/lib/recherche";
import type { Suggestions } from "@/lib/suggestions";
import { LIBELLE_STATUT } from "@/lib/types";
import { useWhatsapp } from "@/components/ui/contexte-contact";
import { Filigrane } from "@/components/ui/filigrane";
import { demarrerNavigation } from "@/components/ui/navigation-en-cours";

const CLE_RECENTES = "mi_recherches_recentes";

function lireRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLE_RECENTES) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function memoriser(q: string) {
  try {
    const liste = [q, ...lireRecentes().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
    localStorage.setItem(CLE_RECENTES, JSON.stringify(liste));
  } catch {
    // Navigation privée ou stockage refusé : les recherches récentes ne sont qu'un confort.
  }
}

/** Morceaux du texte qui répondent à la requête, en surbrillance. */
function Surligne({ texte, q }: { texte: string; q: string }) {
  return (
    <>
      {surligner(texte, decouper(q)).map((p, i) =>
        p.trouve ? (
          <mark key={i} className="bg-transparent font-semibold text-gold-light">
            {p.texte}
          </mark>
        ) : (
          <span key={i}>{p.texte}</span>
        )
      )}
    </>
  );
}

type Option = { cle: string; href?: string; texte?: string };

/**
 * Boîte de recherche du catalogue : suggestions pendant la frappe, au clavier
 * comme au doigt. Reprise de la boîte de 261° WEAR — attente de 150 ms entre
 * deux demandes, demande périmée abandonnée, recherches récentes, « / » pour
 * l'ouvrir de n'importe où — et adaptée au catalogue : une marque ou un type
 * reconnu se propose comme filtre, une moto comme fiche.
 */
export function BoiteRecherche({
  valeur,
  marquesPopulaires,
  onRechercher,
}: {
  valeur: string;
  /** Marques les mieux fournies, proposées tant que rien n'est tapé. */
  marquesPopulaires: { nom: string; effectif: number }[];
  onRechercher: (q: string | undefined) => void;
}) {
  const router = useRouter();
  const whatsapp = useWhatsapp();
  const id = useId();
  const champ = useRef<HTMLInputElement>(null);
  const racine = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(valeur);
  const [ouverte, setOuverte] = useState(false);
  const [donnees, setDonnees] = useState<Suggestions | null>(null);
  const [chargement, setChargement] = useState(false);
  const [active, setActive] = useState(-1);
  const [recentes, setRecentes] = useState<string[]>([]);
  const requete = q.trim();

  // Suit l'URL : retour arrière, puce « recherche » retirée.
  const [valeurSuivie, setValeurSuivie] = useState(valeur);
  if (valeur !== valeurSuivie) {
    setValeurSuivie(valeur);
    setQ(valeur);
  }

  useEffect(() => {
    setRecentes(lireRecentes());
    champ.current?.focus();
  }, []);

  useEffect(() => {
    const auClic = (e: globalThis.MouseEvent) => {
      if (!racine.current?.contains(e.target as Node)) setOuverte(false);
    };
    document.addEventListener("mousedown", auClic);
    return () => document.removeEventListener("mousedown", auClic);
  }, []);

  useEffect(() => {
    if (!requete) return;
    const abandon = new AbortController();
    const minuterie = setTimeout(async () => {
      setChargement(true);
      try {
        const r = await fetch(`/api/recherche?q=${encodeURIComponent(requete)}`, { signal: abandon.signal });
        if (!r.ok) throw new Error(String(r.status));
        setDonnees((await r.json()) as Suggestions);
        setActive(-1);
      } catch {
        // Abandonnée, hors ligne ou refusée : les suggestions précédentes restent.
      } finally {
        if (!abandon.signal.aborted) setChargement(false);
      }
    }, 150);
    return () => {
      clearTimeout(minuterie);
      abandon.abort();
    };
  }, [requete]);

  const options: Option[] = requete
    ? [
        ...(donnees?.marques ?? []).map((m) => ({ cle: `m:${m.nom}`, href: `/motos?marque=${encodeURIComponent(m.nom)}` })),
        ...(donnees?.categories ?? []).map((c) => ({ cle: `c:${c.cle}`, href: `/motos?cat=${c.cle}` })),
        ...(donnees?.motos ?? []).map((m) => ({ cle: `f:${m.slug}`, href: `/motos/${m.slug}` })),
        { cle: "tout", texte: requete },
      ]
    : [
        ...recentes.map((r) => ({ cle: `r:${r}`, texte: r })),
        ...marquesPopulaires.map((m) => ({ cle: `m:${m.nom}`, href: `/motos?marque=${encodeURIComponent(m.nom)}` })),
      ];

  const choisir = (o: Option | undefined) => {
    if (!o) return;
    if (requete) memoriser(requete);
    setOuverte(false);
    champ.current?.blur();
    if (o.texte !== undefined) return lancer(o.texte);
    if (o.href) {
      demarrerNavigation();
      router.push(o.href);
    }
  };

  const lancer = (texte: string) => {
    const t = texte.trim();
    if (t) {
      memoriser(t);
      pister("recherche", { q: t.slice(0, 80), resultats: donnees?.total ?? -1 });
    }
    setQ(t);
    setOuverte(false);
    onRechercher(t || undefined);
  };

  const auClavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOuverte(true);
      if (!options.length) return;
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % options.length : (i - 1 + options.length) % options.length));
    } else if (e.key === "Escape") {
      if (ouverte) setOuverte(false);
      else setQ("");
    }
  };

  const proprietes = (index: number) => ({
    id: `${id}-o${index}`,
    role: "option" as const,
    "aria-selected": active === index,
    onMouseEnter: () => setActive(index),
    // Garde le clavier ouvert sur téléphone : le champ ne perd pas le focus avant le clic.
    onMouseDown: (e: MouseEvent) => e.preventDefault(),
    onClick: () => choisir(options[index]),
    className: clsx(
      "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[15px]",
      active === index ? "bg-surface-hi" : ""
    ),
  });

  const decalageMotos = (donnees?.marques.length ?? 0) + (donnees?.categories.length ?? 0);
  const panneau = ouverte && (requete ? Boolean(donnees) || chargement : recentes.length + marquesPopulaires.length > 0);
  const liste = `${id}-liste`;

  return (
    <div ref={racine} className="relative">
      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && options[active]) choisir(options[active]);
          else lancer(q);
        }}
      >
        <div className="relative flex-1">
          <input
            ref={champ}
            type="search"
            name="q"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOuverte(true);
              if (!e.target.value.trim()) setDonnees(null);
            }}
            onFocus={() => {
              setRecentes(lireRecentes());
              setOuverte(true);
            }}
            onKeyDown={auClavier}
            placeholder="Marque, modèle, type : Honda, CB500X, cross…"
            aria-label="Rechercher une moto"
            role="combobox"
            aria-expanded={panneau}
            aria-controls={liste}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
            enterKeyHint="search"
            autoComplete="off"
            maxLength={80}
            // 16 px : en deçà, Safari sur iPhone zoome sur le champ au toucher.
            className="champ pr-10 text-[16px] [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setDonnees(null);
                champ.current?.focus();
              }}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-dim hover:text-text"
              aria-label="Effacer la recherche"
            >
              ✕
            </button>
          ) : null}
        </div>
        <button type="submit" className="btn-or px-5">
          OK
        </button>
      </form>

      {panneau ? (
        <div
          id={liste}
          role="listbox"
          aria-label="Suggestions"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-auto border border-line bg-surface py-2 shadow-xl shadow-black/50"
        >
          {!requete ? (
            <>
              {recentes.length ? (
                <div className="flex items-center justify-between px-4 pb-1 pt-1">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-dim">Recherches récentes</p>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      try {
                        localStorage.removeItem(CLE_RECENTES);
                      } catch {
                        /* stockage indisponible */
                      }
                      setRecentes([]);
                    }}
                    className="text-[12px] text-chrome underline"
                  >
                    Effacer
                  </button>
                </div>
              ) : null}
              {recentes.map((r, i) => (
                <div key={r} {...proprietes(i)}>
                  <span aria-hidden className="text-dim">↺</span>
                  {r}
                </div>
              ))}
              {marquesPopulaires.length ? (
                <p className="px-4 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-dim">Marques</p>
              ) : null}
              {marquesPopulaires.map((m, i) => (
                <div key={m.nom} {...proprietes(recentes.length + i)}>
                  <span className="flex-1">{m.nom}</span>
                  <span className="text-[13px] text-dim">{m.effectif}</span>
                </div>
              ))}
            </>
          ) : donnees ? (
            <>
              {donnees.approximatif ? (
                <p className="px-4 pb-2 pt-1 text-[13px] text-chrome">Rien d&apos;exact pour « {requete} » : les plus proches.</p>
              ) : null}
              {donnees.marques.map((m, i) => (
                <div key={m.nom} {...proprietes(i)}>
                  <span className="flex-1">
                    Toutes les <span className="font-semibold text-text">{m.nom}</span>
                  </span>
                  <span className="text-[13px] text-dim">{m.effectif}</span>
                </div>
              ))}
              {donnees.categories.map((c, i) => (
                <div key={c.cle} {...proprietes(donnees.marques.length + i)}>
                  <span className="flex-1">
                    Type <span className="font-semibold text-text">{c.libelle}</span>
                  </span>
                  <span className="text-[13px] text-dim">{c.effectif}</span>
                </div>
              ))}
              {donnees.motos.map((m, i) => (
                <div key={m.slug} {...proprietes(decalageMotos + i)}>
                  <span className="relative h-[42px] w-14 shrink-0 overflow-hidden bg-surface-hi">
                    {m.photo ? (
                      <>
                        <Image
                          src={m.photo.src}
                          unoptimized={m.photo.cloudinary}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                        {!m.photo.marquee ? <Filigrane largeurMin={0} /> : null}
                      </>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-text">
                      <Surligne texte={`${m.marque} ${m.modele}`} q={requete} />
                    </span>
                    <span className="block truncate text-[13px] text-dim">
                      {m.annee} · {m.cylindree} cm³ · {m.etat === "neuf" ? "Neuve" : "Occasion"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[14px] font-semibold text-gold-light">{arCourt(m.prix_ttc)}</span>
                    {m.statut !== "disponible" ? (
                      <span className="block text-[12px] text-chrome">{LIBELLE_STATUT[m.statut]}</span>
                    ) : null}
                  </span>
                </div>
              ))}
              {donnees.total === 0 ? (
                <p className="px-4 py-3 text-[14px] text-chrome">
                  Aucune moto pour « {requete} ».{" "}
                  <a
                    href={lienRecherche(undefined, whatsapp, requete)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-light underline"
                  >
                    Dites-nous ce que vous cherchez
                  </a>{" "}
                  : nous la sourçons sur commande.
                </p>
              ) : null}
              <div {...proprietes(options.length - 1)}>
                <span className="font-semibold text-gold-light underline">
                  {donnees.total > 1
                    ? `Voir les ${donnees.total} motos pour « ${requete} »`
                    : donnees.total === 1
                      ? `Voir la moto pour « ${requete} »`
                      : `Rechercher « ${requete} »`}
                </span>
              </div>
            </>
          ) : (
            <p className="px-4 py-3 text-[14px] text-dim">Recherche…</p>
          )}
          {chargement && donnees ? <span className="sr-only">Mise à jour des suggestions</span> : null}
        </div>
      ) : null}
    </div>
  );
}
