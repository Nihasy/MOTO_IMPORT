import type { Controle } from "@/lib/publication";

export { controlesPublication } from "@/lib/publication";
export type { Controle } from "@/lib/publication";

/**
 * Affichage des contrôles avant publication (10.3).
 *
 * La règle elle-même vit dans `lib/publication.ts` et est appliquée côté
 * serveur : cet écran la rend lisible, il ne la décide pas.
 */
export function ListeControles({ controles }: { controles: Controle[] }) {
  const bloquants = controles.filter((c) => !c.ok);
  return (
    <section className={`carte p-4 ${bloquants.length ? "border-vendu/50" : "border-dispo/50"}`}>
      <h2 className="text-[17px] font-semibold">
        {bloquants.length
          ? `Publication bloquée — ${bloquants.length} point${bloquants.length > 1 ? "s" : ""} à corriger`
          : "Prête à publier"}
      </h2>
      <p className="mt-1 text-meta text-dim">
        {bloquants.length
          ? "Tant qu'un point reste rouge, le statut ne peut pas passer en « Disponible », « Disponible de suite » ni « Réservé »."
          : "Le statut peut passer en vente."}
      </p>
      <ul className="mt-3 space-y-2">
        {controles.map((c) => (
          <li key={c.libelle} className="flex items-start gap-2.5 text-corps">
            <span className={c.ok ? "text-dispo" : "text-vendu"} aria-hidden>
              {c.ok ? "✓" : "✗"}
            </span>
            <span>
              <span className={c.ok ? "text-chrome" : "font-medium text-text"}>{c.libelle}</span>
              {c.detail ? <span className="block text-meta text-dim">{c.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
