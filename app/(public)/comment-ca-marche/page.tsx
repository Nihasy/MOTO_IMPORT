import type { Metadata } from "next";
import Link from "next/link";
import { BarreSuperieure } from "@/components/ui/navigation";
import { ETAPES_PROCESS } from "@/components/fiche/blocs";
import { lienRecherche } from "@/lib/whatsapp";
import { parametres } from "@/lib/parametres";
import { ACOMPTE_COMMANDE_TEXTE, SOLDE_LIVRAISON_TEXTE } from "@/lib/conditions";

export const metadata: Metadata = {
  title: "Comment ça marche — de la commande à la remise des clés",
  description:
    `Les 5 étapes de l'importation : choix de la moto, confirmation du prix rendu Tana, signature du bon de commande avec acompte de ${ACOMPTE_COMMANDE_TEXTE}, importation, livraison en 45 à 65 jours.`,
  alternates: { canonical: "/comment-ca-marche" },
};

const DETAILS = [
  "Vous parcourez le catalogue, vous ouvrez la fiche, vous voyez le prix final, le délai et l'état exact du véhicule. Vous nous écrivez sur WhatsApp avec la référence.",
  "Nous confirmons la disponibilité auprès de l'atelier, contrôlons les photos, et figeons le prix rendu Antananarivo carte grise incluse. Ce prix est valable jusqu'à la date indiquée sur la fiche.",
  `Vous venez au local. Vous signez le bon de commande et versez l'acompte de ${ACOMPTE_COMMANDE_TEXTE}. C'est le seul moment où de l'argent change de main avant la livraison, et cela se fait en face à face, avec un document signé.`,
  "Nous prenons tout en charge : achat, contrôle avant expédition, fret maritime, dédouanement, mise en conformité et carte grise établie à votre nom.",
  `Nous vous prévenons dès l'arrivée. Vous réglez le solde de ${SOLDE_LIVRAISON_TEXTE} à la remise des clés et des papiers, au local d'Antananarivo.`,
];

export default async function Page() {
  const { whatsapp } = await parametres();
  return (
    <>
      <BarreSuperieure titre="Comment ça marche" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">De la commande à la remise des clés</h1>
        <p className="mt-2 text-corps text-chrome">
          Nous ne tenons pas de stock. Chaque moto est commandée pour un client précis. Voici
          exactement ce qui se passe, étape par étape, et à quel moment vous payez quoi.
        </p>

        <ol className="mt-6 space-y-4">
          {ETAPES_PROCESS.map((e, i) => (
            <li key={e.titre} className="carte p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold text-[18px] font-bold text-gold-light">
                  {i + 1}
                </span>
                <h2 className="text-[17px] font-semibold">{e.titre}</h2>
              </div>
              <p className="mt-2.5 text-corps text-chrome">{DETAILS[i]}</p>
            </li>
          ))}
        </ol>

        <section className="carte mt-6 border-gold/40 p-4">
          <h2 className="text-[17px] font-semibold">« Je paie d'avance quelque chose que je ne vois pas »</h2>
          <p className="mt-2 text-corps text-chrome">
            C'est la question que tout le monde se pose, et elle est légitime. Trois réponses
            concrètes : l'acompte se verse au local, en personne, contre un bon de commande signé
            qui engage les deux parties ; il représente {ACOMPTE_COMMANDE_TEXTE}, pas la totalité ; et le solde de {SOLDE_LIVRAISON_TEXTE} n'est dû
            qu'à la remise des clés, une fois la moto sur place et la carte grise à votre nom.
          </p>
          <p className="mt-2 text-corps text-chrome">
            En cas de désistement de votre part après signature, l'acompte reste acquis : il a déjà
            servi à l'achat du véhicule en Chine. C'est écrit dans les CGV, et nous préférons le
            dire avant plutôt qu'après.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link href="/faq" className="btn-fantome flex-1">Lire la FAQ</Link>
            <Link href="/cgv" className="btn-fantome flex-1">Lire les CGV</Link>
            <a href={lienRecherche(undefined, whatsapp)} target="_blank" rel="noopener noreferrer" className="btn-or flex-1">
              Poser une question
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
