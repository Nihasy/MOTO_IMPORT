import { db } from "@/lib/db";
import { sessionCourante } from "@/lib/auth";
import { enregistrerFournisseur, supprimerFournisseur } from "@/app/admin/actions";
import { BoutonDanger } from "@/components/admin/bouton-danger";
import { EntetePage } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function PageFournisseurs() {
  const session = await sessionCourante();
  if (session?.role !== "admin") {
    return (
      <div className="carte p-6">
        <h1 className="text-titre-fiche">Accès refusé</h1>
        <p className="mt-2 text-corps text-chrome">
          La table des fournisseurs est strictement interne et réservée au compte administrateur.
        </p>
      </div>
    );
  }

  const fournisseurs = await db().listerFournisseurs();

  return (
    <div>
      <EntetePage
        titre="Fournisseurs"
        compte={fournisseurs.length}
        sousTitre="Table strictement interne, réservée à l'administrateur. Aucune route publique ne lit ces données, ni directement ni par jointure : la vue publique exclut explicitement fournisseur_id."
      />

      <form action={enregistrerFournisseur} className="carte mt-4 max-w-xl space-y-3 p-4">
        <h2 className="text-[17px] font-semibold">Ajouter un fournisseur</h2>
        <div>
          <label className="etiquette" htmlFor="nom">Nom *</label>
          <input id="nom" name="nom" required className="champ" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiquette" htmlFor="contact">Contact</label>
            <input id="contact" name="contact" className="champ" />
          </div>
          <div>
            <label className="etiquette" htmlFor="ville_chine">Ville (Chine)</label>
            <input id="ville_chine" name="ville_chine" className="champ" />
          </div>
        </div>
        <div>
          <label className="etiquette" htmlFor="specialite">Spécialité</label>
          <input id="specialite" name="specialite" className="champ" />
        </div>
        <div>
          <label className="etiquette" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} className="champ py-2.5" />
        </div>
        <button type="submit" className="btn-or w-full">Enregistrer</button>
      </form>

      <ul className="mt-5 space-y-2">
        {fournisseurs.map((f) => (
          <li key={f.id} className="carte flex flex-wrap items-center justify-between gap-3 p-3.5">
            <div className="min-w-0">
              <p className="text-corps font-semibold">{f.nom}</p>
              <p className="text-meta text-dim">
                {[f.ville_chine, f.specialite, f.contact].filter(Boolean).join(" · ") || "—"}
              </p>
              {f.notes ? <p className="mt-1 text-meta text-chrome">{f.notes}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-card bg-surface-hi px-2.5 py-1 text-badge font-semibold text-chrome">
                {f.nb_motos} moto{f.nb_motos > 1 ? "s" : ""}
              </span>
              <div className="w-[210px] max-w-full">
                <BoutonDanger
                  action={supprimerFournisseur}
                  champsCaches={{ id: f.id }}
                  libelle="Supprimer"
                  avertissement={
                    f.nb_motos
                      ? `${f.nb_motos} moto${f.nb_motos > 1 ? "s" : ""} perdra${f.nb_motos > 1 ? "ont" : ""} son rattachement fournisseur. Les fiches restent en ligne.`
                      : "Aucune moto n'est rattachée à ce fournisseur."
                  }
                />
              </div>
            </div>
          </li>
        ))}
        {fournisseurs.length === 0 ? (
          <li className="carte p-6 text-center text-corps text-dim">Aucun fournisseur enregistré.</li>
        ) : null}
      </ul>
    </div>
  );
}
