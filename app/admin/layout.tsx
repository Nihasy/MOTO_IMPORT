import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionCourante } from "@/lib/auth";
import { db } from "@/lib/db";
import { estPublic } from "@/lib/types";
import { NavAdmin, type Onglet } from "@/components/admin/nav";
import { Marque } from "@/components/ui/logo";
import { deconnexion } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Back-office",
  robots: { index: false, follow: false },
};

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const session = await sessionCourante();
  if (!session) redirect("/connexion");

  // Les pastilles de navigation sont calculées ici, une fois, pour tous les
  // écrans : elles disent depuis n'importe quelle page ce qui attend une
  // action, sans qu'il faille ouvrir chaque section pour le découvrir.
  const pilote = db();
  const [motos, demandes] = await Promise.all([
    pilote.listerMotosAdmin().catch(() => []),
    pilote.listerDemandes().catch(() => []),
  ]);

  const brouillons = motos.filter((m) => m.statut === "brouillon").length;
  const publieesIncompletes = motos.filter(
    (m) => estPublic(m.statut) && m.vues_manquantes.length > 0
  ).length;
  const nouvellesDemandes = demandes.filter((d) => d.statut === "nouveau").length;

  const onglets: Onglet[] = [
    { href: "/admin", libelle: "Tableau de bord" },
    {
      href: "/admin/motos",
      libelle: "Motos",
      compte: publieesIncompletes || brouillons,
      ton: publieesIncompletes ? "alerte" : "action",
    },
    { href: "/admin/import", libelle: "Import" },
    { href: "/admin/demandes", libelle: "Demandes", compte: nouvellesDemandes, ton: "alerte" },
    ...(session.role === "admin"
      ? [{ href: "/admin/fournisseurs", libelle: "Fournisseurs" } as Onglet]
      : []),
  ];

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur">
        <div className="conteneur-large flex h-14 items-center justify-between gap-3">
          <Link href="/admin" className="flex items-center gap-2.5">
            <Marque taille={28} texte={15} />
            <span className="rounded-card border border-line px-2 py-0.5 text-[10px] font-semibold uppercase text-dim">
              {session.role}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/motos"
              target="_blank"
              rel="noopener"
              className="min-h-touch px-2 text-[12.5px] text-chrome hover:text-text"
            >
              Voir le site ↗
            </Link>
            <form action={deconnexion}>
              <button type="submit" className="min-h-touch px-2 text-[12.5px] text-dim hover:text-text">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
        <NavAdmin onglets={onglets} />
      </header>
      <main className="conteneur-large py-5">{children}</main>
    </div>
  );
}
