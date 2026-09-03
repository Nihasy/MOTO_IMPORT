import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { arCourt } from "@/lib/format";
import { lienRecherche } from "@/lib/whatsapp";
import { BarreSuperieure } from "@/components/ui/navigation";
import { CarteMoto } from "@/components/catalogue/carte-moto";
import { CommentCaSePasse } from "@/components/fiche/blocs";
import { EtatVide, Section } from "@/components/ui";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "MOTO IMPORT — Motos importées, rendues à Antananarivo carte grise incluse",
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
  const toutes = await db().listerMotosPubliques({ masquerVendues: true });
  const enAvant = toutes
    .filter((m) => m.statut === "dispo_immediate" || m.statut === "disponible")
    .slice(0, 6);

  return (
    <>
      <BarreSuperieure />

      <main className="conteneur-large pb-24">
        {/* Accroche. Volontairement dépouillée : trois cartes d'arguments sous
            le titre repoussaient le catalogue hors du premier écran, alors que
            l'information qu'elles portaient tient en une phrase. Les faits
            imposés par les CGV — prix final rendu Tana, carte grise au nom de
            l'acheteur, délai de 45 à 65 jours — sont donc dans l'intro, où ils
            se lisent d'un trait au lieu d'être découpés en trois boîtes. */}
        <section className="relative isolate max-w-[740px] py-14 sm:py-20">
          {/* Halo laiton très bas en opacité : la seule ornementation de la
              page. Décoratif, donc hors du flux et hors du pointeur. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-24 -z-10 h-[420px] w-[520px] rounded-full opacity-[0.07] blur-3xl"
            style={{ background: "radial-gradient(closest-side, #C08A2E, transparent)" }}
          />

          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Importation sur commande · Antananarivo
          </p>

          <h1 className="mt-5 text-[38px] font-bold leading-[1.06] tracking-tight sm:text-[54px]">
            La moto que vous voulez,
            <br />
            <span className="text-gold-light">rendue à Tana.</span>
          </h1>

          <p className="mt-5 max-w-[34rem] text-[16px] leading-[1.65] text-chrome">
            Neuves et d&apos;occasion, sourcées pour vous chez nos ateliers partenaires en Chine.
            Un seul prix, annoncé d&apos;avance : carte grise établie à votre nom comprise,
            livraison en 45 à 65 jours.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/motos" className="btn-or px-7 sm:flex-none">
              Voir le catalogue
            </Link>
            <Link href="/contact" className="btn-fantome px-7 sm:flex-none">
              Nous contacter
            </Link>
          </div>
        </section>

        <Section titre="Disponibles maintenant" action={{ libelle: "Tout le catalogue →", href: "/motos" }}>
          {enAvant.length ? (
            <div className="grille-annonces">
              {enAvant.map((m) => (
                <CarteMoto key={m.id} moto={m} />
              ))}
            </div>
          ) : (
            <EtatVide
              titre="Le catalogue arrive"
              texte="Nos premières motos sont en cours de préparation. Dites-nous ce que vous cherchez : nous sourçons sur commande."
              action={{ libelle: "Dites-nous ce que vous cherchez", href: lienRecherche() }}
            />
          )}
        </Section>

        <Section titre="Trouver par budget">
          <ul className="grid gap-2">
            {PALIERS.map((p) => (
              <li key={p.libelle}>
                <Link href={p.href} className="carte flex min-h-touch items-center justify-between gap-3 px-4 py-3.5">
                  <span>
                    <span className="block text-[22px] font-bold text-gold-light">
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

        <CommentCaSePasse />

        <Section titre="Qui sommes-nous">
          <div className="carte p-4">
            <p className="text-corps text-chrome">
              MOTO IMPORT, c&apos;est deux associés à Antananarivo. Nihasy gère le sourcing, la
              logistique et les contrats ; sa sœur, motarde, s&apos;occupe de la sélection technique
              et du suivi client. Nous ne vendons pas ce que nous ne prendrions pas nous-mêmes, et
              chaque moto d&apos;occasion est photographiée telle qu&apos;elle est, points d&apos;usure compris.
            </p>
            <Link href="/a-propos" className="mt-3 inline-block text-[12.5px] font-semibold text-gold-light">
              En savoir plus →
            </Link>
          </div>
        </Section>
      </main>
    </>
  );
}
