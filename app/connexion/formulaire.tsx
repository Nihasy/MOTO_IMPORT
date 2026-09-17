"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { connexion, type EtatFormulaire } from "@/app/admin/actions";

function Bouton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-or mt-4 w-full" disabled={pending}>
      {pending ? "Connexion…" : "Se connecter"}
    </button>
  );
}

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(connexion, null);

  return (
    <form action={action} key={etat?.tentative ?? 0} className="mt-4">
      <input type="hidden" name="suite" value={suite} />
      <label className="etiquette" htmlFor="email">
        Adresse e-mail
      </label>
      {/* React vide le formulaire à chaque soumission : l'adresse est reprise
          de la réponse, seul le mot de passe est à ressaisir. */}
      <input
        id="email" name="email" type="email" required autoComplete="username" className="champ"
        defaultValue={etat?.valeurs?.email ?? ""}
      />

      <label className="etiquette mt-3" htmlFor="motdepasse">
        Mot de passe
      </label>
      <input
        id="motdepasse"
        name="motdepasse"
        type="password"
        required
        autoComplete="current-password"
        className="champ"
      />

      {etat?.erreur ? (
        <p role="alert" className="mt-3 rounded-card border border-vendu/50 bg-vendu/10 px-3 py-2 text-meta text-vendu">
          {etat.erreur}
        </p>
      ) : null}

      <Bouton />
    </form>
  );
}
