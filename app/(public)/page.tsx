import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { arCourt } from "@/lib/format";
import { lienRecherche } from "@/lib/whatsapp";
import { parametres } from "@/lib/parametres";
import { BarreSuperieure } from "@/components/ui/navigation";
import { Hero } from "@/components/accueil/hero";
import { CarteMoto } from "@/components/catalogue/carte-moto";
import { CommentCaSePasse } from "@/components/fiche/blocs";
import { EtatVide, Section } from "@/components/ui";

export const revalidate = 3600;

export const metadata: Metadata = {
  // `absolute` : le titre contient déjà la marque, le gabarit « | MOTO IMPORT »
  // l'aurait répétée dans l'onglet et dans les aperçus de partage.
  title: { absolute: "MOTO IMPORT — Motos importées, rendues à Antananarivo carte grise incluse" },
  description:
    "Motos neuves et d'occasion importées de Chine sur commande. Prix final rendu à Antananarivo, carte grise établie à votre nom, livraison en 45 à 65 jours.",
  alternates: { canonical: "/" },
};

const PALIERS = [
  { libelle: "Moins de 10 M Ar", href: "/motos?max=10000000", note: "Premier achat, usage urbain" },
  { libelle: "10 à 15 M Ar", href: "/motos?min=10000000&max=15000000", note: "Le cœur du catalogue" },
  { libelle: "Plus de 15 M Ar", href: "/motos?min=15000000", note: "Grosses cylindrées et trails" },
];

export default async function Accueil() {
  const [toutes, { whatsapp }] = await Promise.all([
    db().listerMotosPubliques({ masquerVendues: true }),
    parametres(),
  ]);
  const enAvant = toutes
    .filter((m) => m.statut === "dispo_immediate" || m.statut === "disponible")
    .slice(0, 6);

  return (
    <>
      <BarreSuperieure />

      {/* Le halo de l'ancienne accroche depassait de 18px a droite sur un
          ecran de moins de 408px. Chrome Android elargit alors la page, et la
          barre de navigation fixe, calee sur cette page elargie, sort en
          partie de l'ecran. Le halo a disparu avec le hero, mais celui-ci
          ressort de la gouttiere par un `-mx-4` : la garde reste. */}
      <main className="conteneur-large pb-24 max-sm:overflow-x-clip">
        {/* Dans `main` et non avant : le `-mx-4` du hero annule la gouttiere
            du conteneur pour venir bord a bord. Hors de lui, il la deborderait
            des deux cotes. */}
        <Hero />

        <Section titre="Disponibles maintenant" action={{ libelle: "Tout le catalogue →", href: "/motos" }}>
          {enAvant.length ? (
            // Six motos sur une grille de quatre laissaient une rangee a moitie
            // vide : trois colonnes font deux rangees pleines.
            <div className="grille-annonces min-[1200px]:grid-cols-3">
              {enAvant.map((m) => (
                <CarteMoto key={m.id} moto={m} />
              ))}
            </div>
          ) : (
            <EtatVide
              titre="Le catalogue arrive"
              texte="Nos premières motos sont en cours de préparation. Dites-nous ce que vous cherchez : nous sourçons sur commande."
              action={{ libelle: "Dites-nous ce que vous cherchez", href: lienRecherche(undefined, whatsapp) }}
            />
          )}
        </Section>

        <Section titre="Trouver par budget">
          <ul className="grid gap-2 md:grid-cols-3 md:gap-4">
            {PALIERS.map((p) => (
              <li key={p.libelle}>
                <Link href={p.href} className="carte flex min-h-touch items-center justify-between gap-3 px-4 py-3.5 transition-colors md:h-full md:px-5 md:py-5 md:hover:border-gold/60">
                  <span>
                    <span className="block text-[22px] font-bold text-gold-light md:whitespace-nowrap md:text-[18px] lg:text-[22px]">
                      {p.libelle}
                    </span>
                    <span className="block text-meta text-chrome">{p.note}</span>
                  </span>
                  <span className="text-gold" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-meta text-dim">
            {toutes.length ? `${toutes.length} motos actuellement proposées · à partir de ${arCourt(Math.min(...toutes.map((m) => m.prix_ttc)))}` : null}
          </p>
        </Section>

        <CommentCaSePasse enLigne />
      </main>
    </>
  );
}
