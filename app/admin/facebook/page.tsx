import Link from "next/link";
import { db } from "@/lib/db";
import { urlMedia } from "@/lib/cloudinary";
import { dateFr } from "@/lib/format";
import {
  BUDGETS, FENETRES_NOUVEAUTE, JOURS_AVANT_REPUBLICATION, campagneDuJour, filtresDepuisParams,
  filtrerStudio, historiqueParMoto, titreSuggere, ventesASignaler,
} from "@/lib/facebook";
import { facebookConfigure } from "@/lib/facebook-graph";
import { lignesStudio } from "@/lib/studio-facebook";
import { CATEGORIES, LIBELLE_CATEGORIE, type Categorie, type PublicationFb } from "@/lib/types";
import { Bandeau, BarreFiltres, EntetePage, PuceFiltre } from "@/components/admin/ui";
import { StudioFacebook } from "@/components/admin/studio-facebook";
import { BoutonVentes } from "@/components/admin/journal-facebook";

export const dynamic = "force-dynamic";
// La publication rend dix cartes et les téléverse une à une chez Facebook.
export const maxDuration = 120;

type Params = {
  jours?: string;
  cat?: string | string[];
  budget?: string;
  etat?: string;
  vente?: string;
  fraicheur?: string;
  q?: string;
};

const MODES: Record<PublicationFb["mode"], string> = {
  direct: "Publié",
  programme: "Programmé",
  manuel: "À la main",
};

export default async function StudioFacebookPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const filtres = filtresDepuisParams(p);
  const cats = filtres.categories ?? [];

  // Le journal vit dans une table à part (migration 0013). Tant qu'elle manque,
  // le Studio reste utilisable : seul l'historique est perdu, et on le dit.
  let publications: PublicationFb[] = [];
  let journalIndisponible = false;
  const [lignes] = await Promise.all([
    lignesStudio(),
    db()
      .listerPublicationsFb()
      .then((l) => (publications = l))
      .catch(() => (journalIndisponible = true)),
  ]);

  const historique = historiqueParMoto(publications);
  const candidates = filtrerStudio(lignes, filtres, historique);
  const vendues = new Set(lignes.filter((m) => m.statut === "vendu").map((m) => m.reference));
  const aSignaler = ventesASignaler(publications, vendues);
  const configure = facebookConfigure();

  /** Lien qui remplace (ou retire, avec `undefined`) un paramètre du filtre. */
  const lien = (patch: Partial<Record<keyof Params, string | string[] | undefined>>) => {
    const suivant = { ...p, ...patch };
    const q = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(suivant)) {
      for (const v of ([] as string[]).concat(valeur ?? [])) if (v) q.append(cle, v);
    }
    const s = q.toString();
    return s ? `/admin/facebook?${s}` : "/admin/facebook";
  };
  const basculerCat = (c: Categorie) =>
    lien({ cat: cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c] });

  return (
    <div>
      <EntetePage
        titre="Studio Facebook"
        compte={candidates.length}
        sousTitre="Filtrez, composez un album, relisez. Chaque photo porte son prix et le lien de sa fiche. Rien ne part sur la page sans votre confirmation."
      />

      {journalIndisponible ? (
        <div className="mb-4">
          <Bandeau ton="alerte" titre="Journal des publications indisponible">
            <p className="mt-1 text-meta text-chrome">
              Appliquez la migration <code>0013_publications_facebook.sql</code> dans Supabase. En attendant, le
              filtre « jamais publiée » ne voit aucun historique.
            </p>
          </Bandeau>
        </div>
      ) : null}

      {aSignaler.length ? (
        <div className="mb-4">
          <Bandeau ton="action" titre={`Ventes à annoncer sur la page (${aSignaler.length} post${aSignaler.length > 1 ? "s" : ""})`}>
            <ul className="mt-2 space-y-2">
              {aSignaler.map(({ publication, refs }) => (
                <li key={publication.id} className="flex flex-wrap items-center justify-between gap-2 text-meta">
                  <span className="text-chrome">
                    {publication.titre || "Album"} · {dateFr(publication.programme_pour ?? publication.created_at)} ·
                    vendues : <strong className="text-text">{refs.join(", ")}</strong>
                  </span>
                  <BoutonVentes publicationId={publication.id} refs={refs} configure={configure} />
                </li>
              ))}
            </ul>
          </Bandeau>
        </div>
      ) : null}

      <form method="get" action="/admin/facebook" className="mb-3 flex gap-2">
        {Object.entries(p).flatMap(([cle, v]) =>
          cle === "q" ? [] : ([] as string[]).concat(v ?? []).map((x) => <input key={cle + x} type="hidden" name={cle} value={x} />)
        )}
        <input
          type="search"
          name="q"
          defaultValue={p.q}
          placeholder="Référence, marque, modèle…"
          aria-label="Rechercher une moto"
          className="champ flex-1"
        />
        <button type="submit" className="btn-fantome px-4">
          Chercher
        </button>
      </form>

      <BarreFiltres legende="Nouveautés">
        <PuceFiltre href={lien({ jours: undefined })} actif={!filtres.jours}>
          Toutes
        </PuceFiltre>
        {FENETRES_NOUVEAUTE.map((j) => (
          <PuceFiltre key={j} href={lien({ jours: String(j) })} actif={filtres.jours === j}>
            {j} derniers jours
          </PuceFiltre>
        ))}
      </BarreFiltres>

      <BarreFiltres legende="Type (plusieurs possibles)">
        <PuceFiltre href={lien({ cat: undefined })} actif={!cats.length}>
          Tous
        </PuceFiltre>
        {CATEGORIES.map((c) => (
          <PuceFiltre key={c} href={basculerCat(c)} actif={cats.includes(c)}>
            {LIBELLE_CATEGORIE[c]}
          </PuceFiltre>
        ))}
      </BarreFiltres>

      <BarreFiltres legende="Budget">
        <PuceFiltre href={lien({ budget: undefined })} actif={!filtres.budget}>
          Tous
        </PuceFiltre>
        {BUDGETS.map((b) => (
          <PuceFiltre key={b.cle} href={lien({ budget: b.cle })} actif={filtres.budget === b.cle}>
            {b.libelle}
          </PuceFiltre>
        ))}
      </BarreFiltres>

      <BarreFiltres legende="État, disponibilité, historique">
        <PuceFiltre href={lien({ etat: filtres.etat === "neuf" ? undefined : "neuf" })} actif={filtres.etat === "neuf"}>
          Neuves
        </PuceFiltre>
        <PuceFiltre
          href={lien({ etat: filtres.etat === "occasion" ? undefined : "occasion" })}
          actif={filtres.etat === "occasion"}
        >
          Occasions
        </PuceFiltre>
        <PuceFiltre href={lien({ vente: filtres.vente === "local" ? undefined : "local" })} actif={filtres.vente === "local"}>
          Au local
        </PuceFiltre>
        <PuceFiltre
          href={lien({ vente: filtres.vente === "commande" ? undefined : "commande" })}
          actif={filtres.vente === "commande"}
        >
          Sur commande
        </PuceFiltre>
        <PuceFiltre
          href={lien({ fraicheur: filtres.fraicheur === "jamais" ? undefined : "jamais" })}
          actif={filtres.fraicheur === "jamais"}
        >
          Jamais publiées
        </PuceFiltre>
        <PuceFiltre
          href={lien({ fraicheur: filtres.fraicheur === "ancienne" ? undefined : "ancienne" })}
          actif={filtres.fraicheur === "ancienne"}
        >
          Pas publiées depuis {JOURS_AVANT_REPUBLICATION} j
        </PuceFiltre>
      </BarreFiltres>

      <StudioFacebook
        // Une nouvelle combinaison de filtres repart d'un album vide : garder
        // la sélection d'un filtre « cross » sous un titre « roadsters » trompe.
        key={JSON.stringify(filtres)}
        candidates={candidates.map((m) => ({
          ...m,
          vignette: m.couverture ? urlMedia(m.couverture.cloudinary_id, "vignette", { origine: m.couverture.origine }) : null,
          historique: historique[m.reference] ?? null,
        }))}
        titreInitial={titreSuggere(filtres)}
        campagne={campagneDuJour()}
        configure={configure}
      />

      <section className="mt-8">
        <h2 className="mb-2 text-[17px] font-semibold">Dernières publications</h2>
        {publications.length === 0 ? (
          <p className="text-meta text-dim">Aucune publication consignée pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {publications.slice(0, 15).map((pub) => (
              <li key={pub.id} className="carte flex flex-wrap items-center justify-between gap-2 p-3 text-meta">
                <span className="min-w-0">
                  <span className="mr-2 rounded-card bg-surface-hi px-2 py-0.5 text-badge font-semibold text-chrome">
                    {MODES[pub.mode]}
                  </span>
                  <strong className="text-text">{pub.titre || "Album"}</strong>
                  <span className="text-dim">
                    {" "}
                    · {dateFr(pub.programme_pour ?? pub.created_at)} · {pub.refs.length} moto
                    {pub.refs.length > 1 ? "s" : ""}
                    {pub.ventes_signalees.length ? ` · ${pub.ventes_signalees.length} vente(s) annoncée(s)` : ""}
                  </span>
                </span>
                {pub.lien_post ? (
                  <Link href={pub.lien_post} target="_blank" rel="noopener" className="font-semibold text-gold-light">
                    Voir le post ↗
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
