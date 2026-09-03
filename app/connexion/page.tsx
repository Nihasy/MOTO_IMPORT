import { redirect } from "next/navigation";
import { destinationSure, sessionCourante } from "@/lib/auth";
import { FormulaireConnexion } from "./formulaire";
import { Marque } from "@/components/ui/logo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connexion au back-office",
  robots: { index: false, follow: false },
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ suite?: string }>;
}) {
  if (await sessionCourante()) redirect("/admin");
  // Assainie des le rendu : le champ cache ne doit jamais porter une valeur
  // controlee par un tiers, meme si la soumission la revaliderait.
  const { suite } = await searchParams;
  const destination = destinationSure(suite);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Marque taille={40} texte={19} />
        </div>
        <div className="carte p-5">
          <h1 className="text-[17px] font-semibold">Back-office</h1>
          <p className="mt-1 text-meta text-dim">Accès réservé aux deux comptes fondateurs.</p>
          <FormulaireConnexion suite={destination} />
        </div>
      </div>
    </div>
  );
}
