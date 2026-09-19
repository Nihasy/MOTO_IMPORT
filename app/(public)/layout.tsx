import Link from "next/link";
import { BarreInferieure } from "@/components/ui/navigation";
import { Marque } from "@/components/ui/logo";

export default function LayoutPublic({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Largeur de page reprise de motoconcess.com : 1200px pour le listing.
          Les pages de texte se recentrent elles-memes sur 680px via `.conteneur`. */}
      <div className="mx-auto min-h-screen w-full max-w-[1200px] pb-16 lg:pb-0">{children}</div>
      <PiedDePage />
      <BarreInferieure />
    </>
  );
}

function PiedDePage() {
  return (
    <footer className="border-t border-line bg-surface pb-20 pt-8 lg:pb-10 lg:pt-12">
      {/* Sur ordinateur, la colonne de 680px laissait deux marges vides de part
          et d'autre : le pied s'aligne sur la largeur du listing, marque et
          promesse a gauche, liens a droite. */}
      <div className="conteneur lg:grid lg:max-w-[1200px] lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-16">
        <div>
          {/* Le verrou de marque est centre, comme dans l'en-tete. Sa racine
              est deja un conteneur flex pleine largeur : `justify-center` suffit
              a recentrer les trois elements du verrou. */}
          <Marque taille={46} texte={20} className="justify-center lg:justify-start" />
          <p className="mt-2 max-w-md text-meta text-dim">
            Importation de motocycles neufs et d&apos;occasion. Prix final rendu à Antananarivo, carte
            grise établie à votre nom. Aucun stock : chaque véhicule est commandé sur mesure.
          </p>
        </div>
        <nav className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-corps sm:grid-cols-3 lg:mt-2 lg:gap-x-12 lg:gap-y-3 lg:self-start">
          <Link href="/motos" className="text-chrome hover:text-text">Catalogue</Link>
          <Link href="/comment-ca-marche" className="text-chrome hover:text-text">Comment ça marche</Link>
          <Link href="/faq" className="text-chrome hover:text-text">FAQ</Link>
          <Link href="/contact" className="text-chrome hover:text-text">Contact</Link>
          <Link href="/cgv" className="text-chrome hover:text-text">CGV</Link>
          <Link href="/mentions-legales" className="text-chrome hover:text-text">Mentions légales</Link>
        </nav>
        <p className="mt-6 text-[11px] text-dim lg:col-span-2 lg:mt-10 lg:border-t lg:border-line lg:pt-5">
          © {new Date().getFullYear()} MOTO IMPORT — Antananarivo, Madagascar.
        </p>
      </div>
    </footer>
  );
}
