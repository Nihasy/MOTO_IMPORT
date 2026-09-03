import type { Metadata } from "next";
import { BarreSuperieure } from "@/components/ui/navigation";
import { lienRecherche, NUMERO_WHATSAPP } from "@/lib/whatsapp";
import { jsonLdSecurise } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Contact — WhatsApp, téléphone, adresse du local",
  description:
    "Contactez MOTO IMPORT à Antananarivo : WhatsApp, téléphone, adresse du local et horaires d'ouverture.",
  alternates: { canonical: "/contact" },
};

const ADRESSE = process.env.NEXT_PUBLIC_ADRESSE ?? "Lot II M 85 Bis, Analamahitsy, Antananarivo 101";
const HORAIRES = [
  ["Lundi – vendredi", "8 h 30 – 17 h 30"],
  ["Samedi", "9 h – 13 h"],
  ["Dimanche", "Fermé"],
];

export default function Page() {
  const tel = "+" + NUMERO_WHATSAPP;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: "MOTO IMPORT",
    telephone: tel,
    address: {
      "@type": "PostalAddress",
      streetAddress: ADRESSE,
      addressLocality: "Antananarivo",
      addressCountry: "MG",
    },
    openingHours: ["Mo-Fr 08:30-17:30", "Sa 09:00-13:00"],
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
          <a href={lienRecherche()} target="_blank" rel="noopener noreferrer" className="btn-or">
            Écrire sur WhatsApp
          </a>
          <a href={`tel:${tel}`} className="btn-fantome">
            Appeler {tel}
          </a>
        </div>

        <section className="carte mt-4 p-4">
          <h2 className="text-[17px] font-semibold">Le local</h2>
          <p className="mt-2 text-corps text-chrome">{ADRESSE}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADRESSE)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[12.5px] font-semibold text-gold-light"
          >
            Ouvrir dans Google Maps →
          </a>
        </section>

        <section className="carte mt-3 p-4">
          <h2 className="text-[17px] font-semibold">Horaires</h2>
          <dl className="mt-2">
            {HORAIRES.map(([j, h]) => (
              <div key={j} className="flex justify-between border-b border-line py-2 text-corps last:border-0">
                <dt className="text-chrome">{j}</dt>
                <dd className="font-medium">{h}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </>
  );
}
