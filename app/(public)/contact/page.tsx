import type { Metadata } from "next";
import { BarreSuperieure } from "@/components/ui/navigation";
import { lienRecherche } from "@/lib/whatsapp";
import { lienTelephone, parametres } from "@/lib/parametres";
import { jsonLdSecurise } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Contact — WhatsApp, téléphone, adresse du local",
  description:
    "Contactez MOTO IMPORT à Antananarivo : WhatsApp, téléphone, adresse du local et horaires d'ouverture.",
  alternates: { canonical: "/contact" },
};

// Adresse, horaires et numéros se règlent dans le back-office (Paramètres).
export default async function Page() {
  const { adresse, horaires, whatsapp, telephone } = await parametres();
  const tel = lienTelephone(telephone);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: "MOTO IMPORT",
    telephone: tel.slice(4),
    address: {
      "@type": "PostalAddress",
      streetAddress: adresse,
      addressLocality: "Antananarivo",
      addressCountry: "MG",
    },
    // Les horaires sont saisis en texte libre dans le back-office : ils ne se
    // traduisent pas de façon sûre en `openingHours` (« Mo-Fr 08:30-17:30 »).
    // Mieux vaut ne rien déclarer que déclarer faux aux moteurs de recherche.
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSecurise(jsonLd) }} />
      <BarreSuperieure titre="Contact" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">Nous joindre</h1>
        <p className="mt-2 text-corps text-chrome">
          Le plus rapide reste WhatsApp : nous répondons dans la journée, du lundi au samedi.
        </p>

        <div className="mt-5 grid gap-2">
          <a href={lienRecherche(undefined, whatsapp)} target="_blank" rel="noopener noreferrer" className="btn-or">
            Écrire sur WhatsApp
          </a>
          <a href={tel} className="btn-fantome">
            Appeler {telephone}
          </a>
        </div>

        <section className="carte mt-4 p-4">
          <h2 className="text-[17px] font-semibold">Le local</h2>
          <p className="mt-2 whitespace-pre-line text-corps text-chrome">{adresse}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[12.5px] font-semibold text-gold-light"
          >
            Ouvrir dans Google Maps →
          </a>
        </section>

        {horaires.length ? (
          <section className="carte mt-3 p-4">
            <h2 className="text-[17px] font-semibold">Horaires</h2>
            <dl className="mt-2">
              {horaires.map(({ jours, heures }, i) => (
                <div key={i} className="flex justify-between gap-4 border-b border-line py-2 text-corps last:border-0">
                  <dt className="text-chrome">{jours}</dt>
                  <dd className="text-right font-medium">{heures}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </main>
    </>
  );
}
