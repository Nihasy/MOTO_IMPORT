import type { Metadata } from "next";
import Link from "next/link";
import { BarreSuperieure } from "@/components/ui/navigation";

export const metadata: Metadata = {
  title: "Plus — informations et documents",
  description: "Comment ça marche, FAQ, à propos, CGV et mentions légales de MOTO IMPORT.",
  alternates: { canonical: "/plus" },
};

const LIENS = [
  { href: "/comment-ca-marche", titre: "Comment ça marche", note: "Les 5 étapes, de la commande aux clés" },
  { href: "/faq", titre: "FAQ", note: "Acompte, délais, carte grise, garantie" },
  { href: "/a-propos", titre: "À propos", note: "Le duo, le dépôt en Chine, le local" },
  { href: "/cgv", titre: "CGV", note: "Conditions générales de vente" },
  { href: "/mentions-legales", titre: "Mentions légales", note: "Éditeur, hébergement, données" },
];

export default function Page() {
  return (
    <>
      <BarreSuperieure titre="Plus" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">Informations</h1>
        <ul className="mt-4 grid gap-2">
          {LIENS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="carte flex min-h-touch items-center justify-between gap-3 px-4 py-3.5">
                <span>
                  <span className="block text-corps font-semibold">{l.titre}</span>
                  <span className="block text-meta text-chrome">{l.note}</span>
                </span>
                <span className="text-gold" aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
