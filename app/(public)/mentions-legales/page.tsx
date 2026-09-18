import type { Metadata } from "next";
import { BarreSuperieure } from "@/components/ui/navigation";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du site MOTO IMPORT : éditeur, hébergement, données personnelles.",
  alternates: { canonical: "/mentions-legales" },
};

export default function Page() {
  return (
    <>
      <BarreSuperieure titre="Mentions légales" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">Mentions légales</h1>
        <div className="mt-5 space-y-5 text-corps leading-relaxed text-chrome">
          <section>
            <h2 className="text-[15px] font-semibold text-gold-light">Éditeur</h2>
            <p className="mt-1.5">
              MOTO IMPORT — importation et vente de motocycles. Antananarivo, Madagascar.
              Contact : voir la page Contact.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-gold-light">Hébergement</h2>
            <p className="mt-1.5">
              Site hébergé par Vercel Inc. Base de données et médias hébergés par Supabase et
              Cloudinary.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-gold-light">Données personnelles</h2>
            <p className="mt-1.5">
              Les informations transmises lors d&apos;une demande de devis (nom, téléphone, message)
              sont utilisées uniquement pour traiter cette demande. Elles ne sont ni vendues ni
              transmises à des tiers. Les adresses IP ne sont jamais conservées en clair : seule une
              empreinte anonymisée est stockée, à des fins de protection contre les abus.
            </p>
            <p className="mt-1.5">
              La fréquentation du site est mesurée avec Vercel Web Analytics, sans cookie et sans
              identifier les visiteurs : seuls des totaux anonymes de pages vues et d&apos;actions
              (ouverture d&apos;une fiche, demande de devis) sont conservés.
            </p>
            <p className="mt-1.5">
              Vous pouvez demander la suppression de vos données en nous écrivant sur WhatsApp.
            </p>
          </section>
          <section>
            <h2 className="text-[15px] font-semibold text-gold-light">Propriété intellectuelle</h2>
            <p className="mt-1.5">
              Les photographies des véhicules réels sont la propriété de MOTO IMPORT. Toute
              reproduction sans autorisation est interdite.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
