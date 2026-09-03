import { db } from "@/lib/db";
import { FormulaireMoto } from "@/components/admin/formulaire-moto";
import { EntetePage } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Référence séquentielle, jamais réutilisée (17.1). */
function referenceSuivante(references: string[]): string {
  const max = references
    .map((r) => Number(r.match(/^MI-(\d+)$/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0);
  return `MI-${String(max + 1).padStart(3, "0")}`;
}

export default async function NouvelleMoto() {
  const pilote = db();
  const [motos, fournisseurs] = await Promise.all([
    pilote.listerMotosAdmin(),
    pilote.listerFournisseurs(),
  ]);

  return (
    <div>
      <EntetePage
        titre="Nouvelle moto"
        sousTitre="La fiche naît en brouillon, invisible du public : vous pouvez la remplir en plusieurs fois. Les photos s'ajoutent après l'enregistrement, et la publication se débloque quand tous les contrôles sont verts."
      />
      <FormulaireMoto
        fournisseurs={fournisseurs}
        referenceSuggeree={referenceSuivante(motos.map((m) => m.reference))}
      />
    </div>
  );
}
