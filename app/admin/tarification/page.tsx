import { db } from "@/lib/db";
import { sessionCourante } from "@/lib/auth";
import { reglagesEnVigueur } from "@/lib/tarification-serveur";
import { prixDynamique } from "@/lib/tarification";
import { EntetePage } from "@/components/admin/ui";
import { FormulaireTarification, type MotoTarifee } from "@/components/admin/formulaire-tarification";

export const dynamic = "force-dynamic";

/**
 * Tarification — INFORMATION INTERNE, réservée à l'administrateur.
 * Réglages du calcul des prix, simulateur, et aperçu de l'effet d'un
 * changement sur les motos dont le prix suit encore les réglages.
 */
export default async function PageTarification() {
  const session = await sessionCourante();
  if (session?.role !== "admin") {
    return (
      <div className="carte p-6">
        <h1 className="text-titre-fiche">Accès refusé</h1>
        <p className="mt-2 text-corps text-chrome">
          La tarification est une information interne, réservée au compte administrateur.
        </p>
      </div>
    );
  }

  const reglages = await reglagesEnVigueur();

  // Table absente (migration 0009 pas encore appliquée) : on le dit, et
  // l'enregistrement est désactivé plutôt que de promettre un recalcul.
  let tableAbsente = false;
  try {
    await db().lireTarification();
  } catch {
    tableAbsente = true;
  }

  const motos: MotoTarifee[] = (await db().listerMotosAdmin())
    .filter((m) => m.prix_yuan && prixDynamique(m.statut))
    .map((m) => ({
      id: m.id,
      reference: m.reference,
      nom: `${m.marque} ${m.modele} ${m.annee}`,
      statut: m.statut,
      prix_yuan: m.prix_yuan!,
      prix_ttc: m.prix_ttc,
    }));

  return (
    <div>
      <EntetePage
        titre="Tarification"
        sousTitre="Information interne. Le prix de vente de chaque moto se calcule à partir de son prix d'achat en yuan et des réglages ci-dessous. Enregistrer recalcule aussitôt les motos en brouillon et disponibles sur commande ; les motos réservées, vendues ou déjà au local gardent leur prix."
      />
      {tableAbsente ? (
        <p className="mb-4 max-w-3xl rounded-card border border-gold/50 bg-gold/10 px-4 py-3 text-meta text-chrome">
          La table <code>tarification</code> n&apos;existe pas encore : appliquez la migration{" "}
          <code>supabase/migrations/0009_tarification.sql</code> dans Supabase (SQL Editor). En
          attendant, les réglages ci-dessous s&apos;appliquent et ne peuvent pas être modifiés.
        </p>
      ) : null}
      <FormulaireTarification reglages={reglages} motos={motos} verrouille={tableAbsente} />
    </div>
  );
}
