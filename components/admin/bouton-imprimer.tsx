"use client";

/**
 * Ouvre la boîte d'impression du navigateur, où « Enregistrer en PDF » produit
 * le fichier. Plutôt qu'un PDF fabriqué côté serveur : aucune bibliothèque à
 * embarquer, et la mise en page reste celle, vérifiable, de la page affichée.
 */
export function BoutonImprimer({ libelle = "Imprimer / Enregistrer en PDF" }: { libelle?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-or px-5">
      {libelle}
    </button>
  );
}
