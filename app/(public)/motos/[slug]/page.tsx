import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ar } from "@/lib/format";
import { urlMedia } from "@/lib/cloudinary";
import { LIBELLE_CATEGORIE } from "@/lib/types";
import { SITE_URL } from "@/lib/site";
import { GalerieFiche } from "@/components/fiche/galerie-fiche";
import { BlocPrix } from "@/components/fiche/bloc-prix";
import { BarreActionFixe } from "@/components/fiche/barre-action";
import {
  CommentCaSePasse, Description, EtatVehicule, FicheTechnique, Reassurance,
} from "@/components/fiche/blocs";
import { CarteMoto } from "@/components/catalogue/carte-moto";
import { BadgeStatut } from "@/components/ui";
import { BadgeNouveau } from "@/components/ui/badge-nouveau";
import { CompteurVue } from "@/components/fiche/compteur-vue";
import { EnteteFiche } from "@/components/fiche/entete-fiche";
import { jsonLdSecurise } from "@/lib/jsonld";

// Statique genere a la construction, revalide a la demande sur modification (5.3).
// `dynamicParams` laisse passer les motos publiees apres le deploiement.
//
// Aucun `loading.tsx` ne doit couvrir cette route : la frontiere Suspense
// diffuserait un 200 avant que `notFound()` puisse repondre, transformant
// chaque slug inconnu en soft-404 indexable (13.1).
export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const slugs = await db().slugsPublies();
    return slugs.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const moto = await db().motoParSlug(slug);
  if (!moto) return { title: "Moto introuvable" };

  const titre = `${moto.marque} ${moto.modele} ${moto.annee} — ${ar(moto.prix_ttc)} rendu Tana`;
  const description = `${moto.marque} ${moto.modele} ${moto.annee}, ${moto.cylindree} cm³, ${
    moto.etat === "neuf" ? "neuve" : "occasion"
  }. ${ar(moto.prix_ttc)} rendu à Antananarivo, carte grise à votre nom incluse. Livraison ${moto.delai_min_jours} à ${moto.delai_max_jours} jours. Réf. ${moto.reference}.`;

  return {
    title: titre,
    description,
    alternates: { canonical: `/motos/${moto.slug}` },
    openGraph: {
      title: `${titre} | MOTO IMPORT`,
      description,
      url: `${SITE_URL}/motos/${moto.slug}`,
      type: "website",
      // `images` est volontairement absent : le fichier opengraph-image.tsx
      // est injecte automatiquement par Next avec son URL versionnee.
    },
    twitter: { card: "summary_large_image", title: titre, description },
  };
}

export default async function FicheMoto({ params }: Props) {
  const { slug } = await params;
  const moto = await db().motoParSlug(slug);
  if (!moto) notFound();

  const similaires = await db().motosSimilaires(slug, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: `${moto.marque} ${moto.modele} ${moto.annee}`,
    brand: { "@type": "Brand", name: moto.marque },
    model: moto.modele,
    vehicleModelDate: String(moto.annee),
    sku: moto.reference,
    vehicleEngine: { "@type": "EngineSpecification", engineDisplacement: { "@type": "QuantitativeValue", value: moto.cylindree, unitCode: "CMQ" } },
    ...(moto.kilometrage !== null
      ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: moto.kilometrage, unitCode: "KMT" } }
      : {}),
    itemCondition: moto.etat === "neuf" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    // La description étant facultative, une clé vide vaudrait moins que pas de
    // clé du tout : les moteurs la liraient comme un descriptif inexistant.
    ...(moto.description.trim() ? { description: moto.description } : {}),
    image: moto.medias.slice(0, 5).map((m) => urlMedia(m.cloudinary_id, "plein", { origine: m.origine })),
    offers: {
      "@type": "Offer",
      price: moto.prix_ttc,
      priceCurrency: "MGA",
      priceValidUntil: moto.prix_valable_jusqu_au,
      availability:
        moto.statut === "dispo_immediate"
          ? "https://schema.org/InStock"
          : moto.statut === "disponible"
            ? "https://schema.org/PreOrder"
            : moto.statut === "reserve"
              ? "https://schema.org/LimitedAvailability"
              : "https://schema.org/SoldOut",
      url: `${SITE_URL}/motos/${moto.slug}`,
      seller: { "@type": "Organization", name: "MOTO IMPORT", address: { "@type": "PostalAddress", addressLocality: "Antananarivo", addressCountry: "MG" } },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSecurise(jsonLd) }} />
      <CompteurVue id={moto.id} reference={moto.reference} />

      <EnteteFiche marque={moto.marque} modele={moto.modele} reference={moto.reference} />

      {/* Colonne de fiche calee sur les 680px de motoconcess.com : au-dela, une
          galerie 4:3 pleine largeur ecrase le reste de la page. */}
      <main className="mx-auto w-full max-w-[680px] pb-40">
        <div className="relative">
          <GalerieFiche medias={moto.medias} alt={`${moto.marque} ${moto.modele} ${moto.annee}`} />
          <div className="pointer-events-none absolute inset-x-4 top-3 flex items-start justify-between gap-2">
            <BadgeStatut statut={moto.statut} className="min-w-0" />
            <BadgeNouveau creeLe={moto.created_at} />
          </div>
        </div>

        <div className="conteneur">
          <h1 className="mt-4 text-titre-fiche">
            {moto.marque} {moto.modele} {moto.annee}
          </h1>
          <p className="mt-1 text-meta text-chrome">
            {[
              `${moto.cylindree} cm³`,
              LIBELLE_CATEGORIE[moto.categorie],
              moto.etat === "neuf" ? "Neuf" : "Occasion",
              moto.kilometrage !== null ? `${moto.kilometrage.toLocaleString("fr-FR")} km` : null,
              moto.couleur,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <BlocPrix moto={moto} />
          <Reassurance moto={moto} />

          <FicheTechnique moto={moto} />
          <EtatVehicule moto={moto} />

          {/* Ordre imposé par le 9.3 : la description, puis les cinq étapes.
              Environ 80 % du trafic arrive directement ici sans passer par
              l'accueil (4.2) — la fiche doit vendre la moto et l'entreprise. */}
          <Description moto={moto} />
          <CommentCaSePasse statut={moto.statut} />

          {similaires.length ? (
            <section className="my-6">
              <h2 className="mb-3 text-[17px] font-semibold">Motos similaires</h2>
              <div className="grille-annonces">
                {similaires.map((m) => (
                  <CarteMoto key={m.id} moto={m} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <BarreActionFixe moto={moto} />
    </>
  );
}
