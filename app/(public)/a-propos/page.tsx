import type { Metadata } from "next";
import Link from "next/link";
import { BarreSuperieure } from "@/components/ui/navigation";

export const metadata: Metadata = {
  title: "À propos — le duo, le dépôt en Chine, le local à Tana",
  description:
    "MOTO IMPORT, deux associés à Antananarivo. Sourcing chez trois ateliers partenaires en Chine, contrôle avant expédition, remise des clés au local.",
  alternates: { canonical: "/a-propos" },
};

export default function Page() {
  return (
    <>
      <BarreSuperieure titre="À propos" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">Deux associés, une seule promesse</h1>

        <section className="carte mt-5 p-4">
          <h2 className="text-[17px] font-semibold">Le duo</h2>
          <p className="mt-2 text-corps text-chrome">
            <strong className="text-text">Nihasy</strong> s&apos;occupe du sourcing, de la logistique,
            des prix et des contrats. C&apos;est lui qui négocie avec les ateliers, suit les
            conteneurs et monte les dossiers de carte grise.
          </p>
          <p className="mt-2 text-corps text-chrome">
            <strong className="text-text">Sa sœur</strong>, motarde depuis douze ans, s&apos;occupe de
            la sélection technique, du contenu et de la relation client. C&apos;est elle qui décide si
            une moto mérite d&apos;entrer au catalogue.
          </p>
        </section>

        <section className="carte mt-3 p-4">
          <h2 className="text-[17px] font-semibold">Le dépôt en Chine</h2>
          <p className="mt-2 text-corps text-chrome">
            Nous travaillons avec trois ateliers partenaires, sélectionnés après visite. Chaque
            véhicule d&apos;occasion est contrôlé et photographié sur place avant expédition, à la date
            indiquée sur sa fiche. Les points d&apos;usure sont montrés, pas cachés en fin de série :
            une moto d&apos;occasion honnête se vend mieux qu&apos;une moto d&apos;occasion maquillée.
          </p>
        </section>

        <section className="carte mt-3 p-4">
          <h2 className="text-[17px] font-semibold">Le local à Tana</h2>
          <p className="mt-2 text-corps text-chrome">
            Tout se conclut physiquement : signature du bon de commande, versement de l&apos;acompte,
            puis remise des clés et des papiers. Vous pouvez passer nous voir avant de vous engager,
            sans rendez-vous et sans obligation.
          </p>
          <Link href="/contact" className="mt-3 inline-block text-[12.5px] font-semibold text-gold-light">
            Nous rendre visite →
          </Link>
        </section>
      </main>
    </>
  );
}
