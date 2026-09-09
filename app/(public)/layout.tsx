import Link from "next/link";
import { BarreInferieure } from "@/components/ui/navigation";
import { Marque } from "@/components/ui/logo";

export default function LayoutPublic({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Largeur de page reprise de motoconcess.com : 1200px pour le listing.
          Les pages de texte se recentrent elles-memes sur 680px via `.conteneur`. */}
      <div className="mx-auto min-h-screen w-full max-w-[1200px] pb-16">{children}</div>
      <PiedDePage />
      <BarreInferieure />
    </>
  );
}

function PiedDePage() {
  return (
    <footer className="border-t border-line bg-surface pb-20 pt-8">
      <div className="conteneur">
        {/* Le verrou de marque est centre, comme dans l'en-tete. Sa racine
            est deja un conteneur flex pleine largeur : `justify-center` suffit
            a recentrer les trois elements du verrou. */}
        <Marque taille={46} texte={20} className="justify-center" />
        <p className="mt-2 max-w-md text-meta text-dim">
          Importation de motocycles neufs et d&apos;occasion. Prix final rendu à Antananarivo, carte
          grise établie à votre nom. Aucun stock : chaque véhicule est commandé sur mesure.
        </p>
        <nav className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-corps sm:grid-cols-3">
          <Link href="/motos" className="text-chrome hover:text-text">Catalogue</Link>
          <Link href="/comment-ca-marche" className="text-chrome hover:text-text">Comment ça marche</Link>
          <Link href="/faq" className="text-chrome hover:text-text">FAQ</Link>
          <Link href="/contact" className="text-chrome hover:text-text">Contact</Link>
          <Link href="/cgv" className="text-chrome hover:text-text">CGV</Link>
          <Link href="/mentions-legales" className="text-chrome hover:text-text">Mentions légales</Link>
        </nav>
        <p className="mt-6 text-[11px] text-dim">
          © {new Date().getFullYear()} MOTO IMPORT — Antananarivo, Madagascar.
        </p>
      </div>
    </footer>
  );
}
