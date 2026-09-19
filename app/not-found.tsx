import Link from "next/link";
import type { Metadata } from "next";
import { BarreInferieure, BarreSuperieure } from "@/components/ui/navigation";
import { PiedDePage } from "@/components/ui/pied-de-page";
import { FournisseurContact } from "@/components/ui/contexte-contact";
import { parametres } from "@/lib/parametres";
import { lienRecherche } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: true },
};

/**
 * Page 404, habillée comme le reste du site : en-tête, navigation et pied de
 * page. Elle couvre aussi une fiche retirée du catalogue — le cas le plus
 * fréquent, un lien partagé sur Facebook après la vente de la moto —, d'où
 * l'offre de la retrouver sur commande.
 */
export default async function Introuvable() {
  const { whatsapp } = await parametres();

  return (
    <FournisseurContact whatsapp={whatsapp}>
      <div className="mx-auto min-h-screen w-full max-w-[1200px] pb-16 lg:pb-0">
        <BarreSuperieure />
        <main className="conteneur pb-24 pt-12 text-center sm:pt-20">
          <p className="text-[64px] font-extrabold leading-none tracking-tight text-gold-light sm:text-[88px]">
            404
          </p>
          <h1 className="mt-3 text-titre-fiche sm:text-[30px] sm:leading-[36px]">
            Cette page n&apos;existe pas
          </h1>
          <p className="mx-auto mt-3 max-w-md text-corps text-chrome">
            Le lien est peut-être incomplet, ou la moto qu&apos;il annonçait a déjà trouvé preneur.
            Le catalogue, lui, est toujours à jour — et ce qui n&apos;y est plus, nous pouvons le
            chercher pour vous.
          </p>

          <div className="mx-auto mt-7 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/motos" className="btn-or px-6 sm:flex-1">
              Voir le catalogue
            </Link>
            <a
              href={lienRecherche(undefined, whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-fantome px-6 sm:flex-1"
            >
              Trouvez-moi une moto
            </a>
          </div>

          <nav aria-label="Autres pages" className="mt-10 border-t border-line pt-6">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-corps">
              <li>
                <Link href="/" className="text-chrome hover:text-text">Accueil</Link>
              </li>
              <li>
                <Link href="/comment-ca-marche" className="text-chrome hover:text-text">Comment ça marche</Link>
              </li>
              <li>
                <Link href="/faq" className="text-chrome hover:text-text">FAQ</Link>
              </li>
              <li>
                <Link href="/contact" className="text-chrome hover:text-text">Contact</Link>
              </li>
            </ul>
          </nav>
        </main>
      </div>
      <PiedDePage />
      <BarreInferieure />
    </FournisseurContact>
  );
}
