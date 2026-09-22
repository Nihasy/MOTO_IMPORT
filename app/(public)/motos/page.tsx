import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { appliquerFiltres, trierCatalogue, TRIS, type Ordre } from "@/lib/db/filtres";
import { VueCatalogue } from "@/components/catalogue/vue-catalogue";
import { Squelette, VoileChargement } from "@/components/ui";
import { FOURCHETTE_DELAI_TEXTE } from "@/lib/conditions";

export const dynamic = "force-dynamic";

/** Nombre de vues transportees par carte, aligne sur la galerie au balayage. */
const VUES_PAR_CARTE = 5;

export const metadata: Metadata = {
  title: "Catalogue — motos importées disponibles",
  description:
    `Motos neuves et d'occasion importées : routière, sportive, roadster, trail, custom, cross, scooter. Prix final rendu à Antananarivo, carte grise incluse, livraison ${FOURCHETTE_DELAI_TEXTE}.`,
  alternates: { canonical: "/motos" },
};

type Params = Promise<Record<string, string | string[] | undefined>>;

const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const liste = (v: string | string[] | undefined) =>
  (premier(v) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export default async function PageCatalogue({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;

  // Une seule lecture du magasin : les effectifs par marque portent sur tout
  // le catalogue, le filtrage se fait ensuite en memoire sur le meme jeu.
  const toutes = await db().listerMotosPubliques();

  // Tri demande dans l'URL, ramene aux valeurs connues : un parametre bricole
  // ne doit pas changer l'ordre de la liste.
  const triDemande = premier(sp.tri) ?? "date";
  const tri = triDemande in TRIS ? triDemande : "date";
  const ordre: Ordre = premier(sp.ordre) === "asc" ? "asc" : "desc";

  const motos = trierCatalogue(
    appliquerFiltres(toutes, {
      categorie: liste(sp.cat).length ? liste(sp.cat) : undefined,
      etat: premier(sp.etat),
      prixMax: premier(sp.max) ? Number(premier(sp.max)) : undefined,
      prixMin: premier(sp.min) ? Number(premier(sp.min)) : undefined,
      marques: liste(sp.marque).length ? liste(sp.marque) : undefined,
      cylindrees: liste(sp.cc).length ? liste(sp.cc) : undefined,
      anneeMin: premier(sp.annee_min) ? Number(premier(sp.annee_min)) : undefined,
      anneeMax: premier(sp.annee_max) ? Number(premier(sp.annee_max)) : undefined,
      masquerVendues: premier(sp.masquer_vendues) === "1",
      recherche: premier(sp.q),
    }),
    tri,
    ordre
    // La galerie de carte n'affiche que cinq vues : transporter les douze
    // alourdit la page sans rien montrer de plus.
  ).map((m) => ({ ...m, medias: m.medias.slice(0, VUES_PAR_CARTE), nb_medias: m.medias.length }));

  const compteur = new Map<string, number>();
  for (const m of toutes) compteur.set(m.marque, (compteur.get(m.marque) ?? 0) + 1);
  const marques = [...compteur.entries()]
    .map(([nom, effectif]) => ({ nom, effectif }))
    .sort((a, b) => b.effectif - a.effectif || a.nom.localeCompare(b.nom));

  const annees = [...new Set(toutes.map((m) => m.annee))].sort((a, b) => b - a);

  // Projection allegee : la feuille de filtres compte les resultats en direct,
  // sans qu'il faille lui transmettre les medias de tout le catalogue.
  const catalogue = toutes.map((m) => ({
    categorie: m.categorie,
    etat: m.etat,
    prix_ttc: m.prix_ttc,
    marque: m.marque,
    cylindree: m.cylindree,
    annee: m.annee,
    statut: m.statut,
    modele: m.modele,
    reference: m.reference,
  }));

  return (
    <Suspense fallback={<SqueletteCatalogue />}>
      {/* Titre principal pour les moteurs de recherche et les lecteurs
          d'écran : la page n'en affiche pas, ses filtres tiennent lieu d'en-tête. */}
      <h1 className="sr-only">Catalogue MOTO IMPORT : motos importées, prix rendu Antananarivo</h1>
      <VueCatalogue motos={motos} marques={marques} annees={annees} catalogue={catalogue} />
    </Suspense>
  );
}

/*
 * Le catalogue garde ses plaques en forme d'annonce : elles disent la mise en
 * page qui arrive, ce qu'une animation centrale ne dit pas. Le voile les
 * floute et porte la moto au centre de l'écran — la silhouette des annonces
 * transparaît derrière, l'attente est signée sans que l'œil parte la chercher
 * en haut de la page.
 *
 * Cette attente reste tenue par la frontière Suspense de la page, jamais par
 * un `loading.tsx` : un tel fichier couvrirait aussi `motos/[slug]`, dont la
 * route interdit toute frontière — elle diffuserait un 200 avant que
 * `notFound()` puisse répondre (13.1).
 */
function SqueletteCatalogue() {
  return (
    <div className="conteneur-large pt-20">
      {[0, 1, 2].map((i) => (
        <div key={i} className="carte mb-4 overflow-hidden">
          <Squelette className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Squelette className="h-5 w-1/2" />
            <Squelette className="h-4 w-2/3" />
            <Squelette className="h-8 w-2/5" />
          </div>
        </div>
      ))}
      <VoileChargement texte="Chargement du catalogue" />
    </div>
  );
}
