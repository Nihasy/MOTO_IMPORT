import type { Metadata } from "next";
import Link from "next/link";
import { BarreSuperieure } from "@/components/ui/navigation";
import { jsonLdSecurise } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "FAQ — acompte, délais, carte grise, garantie",
  description:
    "Pourquoi un acompte de 35 %, que se passe-t-il en cas de désistement, qui fait la carte grise, d'où viennent les motos, que couvre la garantie, livraison en province.",
  alternates: { canonical: "/faq" },
};

const QUESTIONS = [
  {
    q: "Pourquoi un acompte de 35 % ?",
    r: "Parce que nous ne tenons aucun stock. À la signature de votre bon de commande, nous achetons effectivement la moto chez notre partenaire en Chine et engageons le fret. L'acompte couvre cet engagement. Sans lui, nous devrions immobiliser notre trésorerie sur des véhicules que personne n'a commandés, et les prix affichés seraient plus élevés.",
    cgv: "Article 4 — Commande et acompte",
  },
  {
    q: "Que se passe-t-il si je me désiste ?",
    r: "Après signature du bon de commande, l'acompte reste acquis à MOTO IMPORT. Le véhicule a déjà été acheté et expédié à votre demande. Nous le disons clairement avant la signature, jamais après. Avant signature, vous ne devez rien et vous pouvez changer d'avis librement.",
    cgv: "Article 6 — Annulation et désistement",
  },
  {
    q: "Le prix peut-il changer entre la commande et la livraison ?",
    r: "Le prix affiché est valable jusqu'à la date indiquée sur chaque fiche. Une fois le bon de commande signé, le prix est ferme : ni la variation du fret, ni celle du taux de change ne vous sont répercutées, sauf variation exceptionnelle des droits de douane prévue aux CGV.",
    cgv: "Article 5 — Prix",
  },
  {
    q: "Qui fait la carte grise ?",
    r: "Nous. La carte grise malgache est établie à votre nom et son coût est déjà compris dans le prix affiché. Vous n'avez aucune démarche administrative à effectuer : vous récupérez la moto et ses papiers en même temps.",
    cgv: "Article 7 — Immatriculation",
  },
  {
    q: "Puis-je voir la moto avant de payer ?",
    r: "Pas physiquement avant la commande, puisqu'elle n'est pas encore importée. C'est précisément pourquoi nos fiches comportent au minimum 9 photos pour le neuf et 12 pour l'occasion, prises sur le véhicule réel, avec les points d'usure montrés et non dissimulés. Vous pouvez aussi passer au local nous rencontrer avant de vous engager.",
    cgv: "Article 3 — Description des véhicules",
  },
  {
    q: "D'où viennent les motos ?",
    r: "De trois ateliers partenaires en Chine, sélectionnés et visités par nos soins. Les véhicules d'occasion sont contrôlés avant expédition, photographiés à la date indiquée sur la fiche, et leur kilométrage est celui relevé au compteur.",
    cgv: "Article 3 — Description des véhicules",
  },
  {
    q: "Que couvre la garantie ?",
    r: "Seuls les véhicules neufs sont garantis. La durée et les organes couverts sont fixés par la marque et par le concessionnaire d'origine : ils varient d'un modèle à l'autre et sont indiqués sur la fiche du véhicule. Les motos d'occasion sont vendues en l'état, sans garantie ; en contrepartie leur état est décrit sur la fiche, points d'usure compris, avec des photos datées prises sur le véhicule précis. Dans tous les cas sont exclues les pièces d'usure normale et les dommages résultant d'un défaut d'entretien, d'un usage inadapté ou d'une modification du véhicule.",
    cgv: "Article 8 — Garantie",
  },
  {
    q: "Livrez-vous en province ?",
    r: "La livraison est comprise jusqu'à notre local d'Antananarivo. Un acheminement vers une autre ville est possible, à organiser et à chiffrer avec nous au moment de la commande.",
    cgv: "Article 9 — Livraison",
  },
];

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QUESTIONS.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.r },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSecurise(jsonLd) }} />
      <BarreSuperieure titre="FAQ" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">Questions fréquentes</h1>
        <p className="mt-2 text-corps text-chrome">
          Les huit questions qu&apos;on nous pose systématiquement. Chaque réponse renvoie à
          l&apos;article correspondant de nos conditions générales de vente.
        </p>

        <div className="mt-5 space-y-3">
          {QUESTIONS.map((x) => (
            <details key={x.q} className="carte group px-4 py-3">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 text-corps font-semibold">
                {x.q}
                <span className="text-gold transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-corps text-chrome">{x.r}</p>
              <Link href="/cgv" className="mt-2 inline-block text-meta text-gold-light underline">
                CGV — {x.cgv}
              </Link>
            </details>
          ))}
        </div>
      </main>
    </>
  );
}
