import Link from "next/link";
import clsx from "clsx";
import Image from "next/image";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ar, arCourt } from "@/lib/format";
import { filigraneIncruste, servieParCloudinary, urlMedia } from "@/lib/cloudinary";
import type { MotoAvecMedias } from "@/lib/types";
import { Filigrane } from "@/components/ui/filigrane";
import { lienRecherche } from "@/lib/whatsapp";
import { BarreSuperieure } from "@/components/ui/navigation";
import { CarteMoto } from "@/components/catalogue/carte-moto";
import { CommentCaSePasse } from "@/components/fiche/blocs";
import { BadgeStatut, EtatVide, Section } from "@/components/ui";

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
  const vedette = enAvant.find((m) => m.medias.length > 0);

  return (
    <>
      <BarreSuperieure />

      {/* Le halo de l'accroche depasse de 18px a droite sur un ecran de moins
          de 408px. Chrome Android elargit alors la page, et la barre de
          navigation fixe, calee sur cette page elargie, sort en partie de
          l'ecran. Couper le debordement horizontal ne change rien a ce qui
          s'affiche : la partie coupee etait deja hors de l'ecran. */}
      <main className="conteneur-large pb-24 max-sm:overflow-x-clip">
        {/* Accroche. Volontairement dépouillée : elle promet, elle ne détaille
            pas. Les faits imposés par les CGV — prix final rendu Tana, carte
            grise au nom de l'acheteur, délai de 45 à 65 jours — se lisent sur
            chaque carte du catalogue et sur chaque fiche, c'est-à-dire au
            moment où ils servent à décider. Les répéter ici repoussait le
            catalogue hors du premier écran pour dire deux fois la même chose. */}
        {/* Deux colonnes seulement quand une moto peut occuper la seconde : sans
            elle, la colonne vide ecrasait l'accroche sur trois lignes. */}
        <section
          className={clsx(
            "relative isolate max-w-[740px] py-14 sm:py-20",
            vedette &&
              "lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:items-center lg:gap-12 lg:py-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:gap-20"
          )}
        >
          {/* Halo laiton très bas en opacité : la seule ornementation de la
              page. Décoratif, donc hors du flux et hors du pointeur. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-24 -z-10 h-[420px] w-[520px] rounded-full opacity-[0.07] blur-3xl"
            style={{ background: "radial-gradient(closest-side, #C08A2E, transparent)" }}
          />

          {/* La coupure est imposée à partir de sm seulement : sur un
              téléphone, « Votre prochaine moto » passe déjà sur deux lignes et
              la forcer en laissait une troisième avec le seul mot « moto ». */}
          <div>
            <h1 className="text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[54px] sm:leading-[1.06] lg:text-[48px] xl:text-[56px]">
              Votre prochaine moto{" "}
              <br className="hidden sm:inline" />
              <span className="text-gold-light">vous attend.</span>
            </h1>

            <p className="mt-6 max-w-[34rem] text-[19px] font-medium leading-[1.5] text-text sm:text-[21px]">
              Dites-nous laquelle. Nous allons la chercher.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/motos" className="btn-or px-7 sm:flex-none">
                Voir le catalogue
              </Link>
              <Link href="/contact" className="btn-fantome px-7 sm:flex-none">
                Nous contacter
              </Link>
            </div>
          </div>

          {vedette ? <Vedette moto={vedette} /> : null}
        </section>

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
              action={{ libelle: "Dites-nous ce que vous cherchez", href: lienRecherche() }}
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

/**
 * Moto mise en avant a cote de l'accroche, sur ordinateur seulement : a cette
 * largeur, l'accroche seule laissait la moitie droite du premier ecran vide.
 * Masquee en dessous (et chargee paresseusement), elle ne coute rien au
 * telephone.
 */
function Vedette({ moto }: { moto: MotoAvecMedias }) {
  const photo = moto.medias[0];
  return (
    <Link
      href={`/motos/${moto.slug}`}
      className="group relative hidden overflow-hidden border border-line bg-surface transition-colors hover:border-gold/60 lg:block"
    >
      <div className="photo-protegee relative aspect-[4/3] bg-surface-hi">
        <Image
          src={urlMedia(photo.cloudinary_id, "galerie", { origine: photo.origine })}
          unoptimized={servieParCloudinary(photo.cloudinary_id)}
          alt={photo.alt || `${moto.marque} ${moto.modele} ${moto.annee}`}
          fill
          sizes="520px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        {photo.origine === "reelle" && !filigraneIncruste(photo.cloudinary_id, "galerie", { origine: photo.origine }) ? (
          <Filigrane />
        ) : null}
        <BadgeStatut statut={moto.statut} className="absolute left-3 top-3" />
      </div>
      <div className="flex items-end justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-badge uppercase tracking-wide text-dim">À la une</p>
          <p className="mt-1 truncate text-titre-carte">
            {moto.marque} {moto.modele}
          </p>
          <p className="text-meta text-chrome">
            {moto.annee} · {moto.cylindree} cm³ · {moto.etat === "neuf" ? "Neuf" : "Occasion"}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-prix-carte text-gold-light">{ar(moto.prix_ttc)}</span>
          <span className="mt-1 block text-[12px] text-dim">rendu Tana, carte grise incluse</span>
        </p>
      </div>
    </Link>
  );
}
