"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Action destructive, jamais atteignable en un seul geste.
 *
 * Deux niveaux selon ce qui est en jeu :
 *  - sans `motDePasse`, un simple armement en deux clics, qui se désarme seul
 *    au bout de dix secondes ;
 *  - avec `motDePasse`, il faut recopier une chaîne exacte — la référence de la
 *    moto. Supprimer une fiche détruit son URL, ses partages Facebook et le
 *    référencement acquis : ce n'est pas une erreur qu'on doit pouvoir faire
 *    d'un pouce mal placé sur un téléphone.
 */
export function BoutonDanger({
  action,
  champsCaches,
  libelle,
  motDePasse,
  avertissement,
}: {
  action: (form: FormData) => void | Promise<void>;
  champsCaches?: Record<string, string>;
  libelle: string;
  motDePasse?: string;
  avertissement?: string;
}) {
  const [arme, setArme] = useState(false);
  const [saisie, setSaisie] = useState("");
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Désarmement automatique : un bouton rouge laissé actif finit par être
  // cliqué par distraction.
  useEffect(() => {
    if (!arme || motDePasse) return;
    minuteur.current = setTimeout(() => setArme(false), 10_000);
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [arme, motDePasse]);

  if (!arme) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setArme(true)}
          className="min-h-touch w-full rounded-card border border-line px-4 text-[12.5px] font-semibold text-dim transition-colors hover:border-vendu/60 hover:text-vendu"
        >
          {libelle}
        </button>
        {avertissement ? <p className="mt-1.5 text-meta text-dim">{avertissement}</p> : null}
      </div>
    );
  }

  const pretAConfirmer = !motDePasse || saisie.trim() === motDePasse;

  return (
    <form action={action} className="rounded-card border border-vendu/50 bg-vendu/5 p-3">
      {Object.entries(champsCaches ?? {}).map(([nom, valeur]) => (
        <input key={nom} type="hidden" name={nom} value={valeur} />
      ))}

      <p className="text-corps font-semibold text-vendu">Cette action est irréversible.</p>
      {avertissement ? <p className="mt-1 text-meta text-chrome">{avertissement}</p> : null}

      {motDePasse ? (
        <div className="mt-2.5">
          <label className="etiquette" htmlFor="confirmation-danger">
            Recopiez <span className="font-bold text-text">{motDePasse}</span> pour confirmer
          </label>
          <input
            id="confirmation-danger"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="champ"
          />
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Confirmer actif={pretAConfirmer} libelle={libelle} />
        <button
          type="button"
          onClick={() => {
            setArme(false);
            setSaisie("");
          }}
          className="btn-fantome px-4"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

/**
 * Le bouton se verrouille pendant l'envoi : sans cela, un double appui sur un
 * réseau lent déclenche deux fois la même suppression.
 */
function Confirmer({ actif, libelle }: { actif: boolean; libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!actif || pending}
      className="btn min-h-touch flex-1 border border-vendu bg-vendu/15 px-4 text-vendu disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Suppression…" : libelle}
    </button>
  );
}
