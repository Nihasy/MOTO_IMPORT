import { db } from "@/lib/db";
import { sessionCourante } from "@/lib/auth";
import { parametres } from "@/lib/parametres";
import { enregistrerParametres } from "@/app/admin/actions";
import { EntetePage } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Lignes d'horaires proposées à la saisie : les vides sont ignorées. */
const LIGNES_HORAIRES = 7;

export default async function PageParametres({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const session = await sessionCourante();
  if (session?.role !== "admin") {
    return (
      <div className="carte p-6">
        <h1 className="text-titre-fiche">Accès refusé</h1>
        <p className="mt-2 text-corps text-chrome">
          Les coordonnées du local et le numéro WhatsApp sont réservés au compte administrateur.
        </p>
      </div>
    );
  }

  const { ok, erreur } = await searchParams;
  const actuels = await parametres();

  // Table absente (migration 0008 pas encore appliquée) ou jamais enregistrée :
  // le site affiche les valeurs par défaut, et on le dit.
  let etat: "enregistre" | "defaut" | "table-absente" = "defaut";
  try {
    etat = (await db().lireParametres()) ? "enregistre" : "defaut";
  } catch {
    etat = "table-absente";
  }

  const horaires = [
    ...actuels.horaires,
    ...Array.from({ length: Math.max(0, LIGNES_HORAIRES - actuels.horaires.length) }, () => ({
      jours: "",
      heures: "",
    })),
  ];

  return (
    <div>
      <EntetePage
        titre="Paramètres"
        sousTitre="Coordonnées affichées sur le site public : page Contact, liens « Demander le devis » de chaque moto et bouton d'appel. Toute modification est en ligne dès l'enregistrement."
      />

      {ok ? (
        <p role="status" className="mt-4 max-w-xl rounded-card border border-dispo/50 bg-dispo/10 px-4 py-3 text-corps text-text">
          Enregistré. Le site public affiche désormais ces coordonnées.
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mt-4 max-w-xl rounded-card border border-vendu/60 bg-vendu/10 px-4 py-3 text-corps text-text">
          {erreur}
        </p>
      ) : null}
      {etat === "table-absente" ? (
        <p className="mt-4 max-w-xl rounded-card border border-gold/50 bg-gold/10 px-4 py-3 text-meta text-chrome">
          La table <code>parametres</code> n&apos;existe pas encore dans la base : appliquez la
          migration <code>supabase/migrations/0008_parametres.sql</code> dans Supabase (SQL Editor).
          En attendant, le site affiche les valeurs ci-dessous et rien ne peut être enregistré.
        </p>
      ) : etat === "defaut" ? (
        <p className="mt-4 max-w-xl text-meta text-dim">
          Rien n&apos;a encore été enregistré ici : le site affiche les valeurs par défaut ci-dessous.
        </p>
      ) : null}

      <form action={enregistrerParametres} className="mt-4 max-w-xl space-y-5">
        <section className="carte space-y-3 p-4">
          <h2 className="text-[17px] font-semibold">Numéros</h2>
          <div>
            <label className="etiquette" htmlFor="whatsapp">Numéro WhatsApp *</label>
            <input
              id="whatsapp"
              name="whatsapp"
              required
              inputMode="tel"
              defaultValue={`+${actuels.whatsapp}`}
              className="champ"
            />
            <p className="mt-1 text-meta text-dim">
              Reçoit toutes les demandes de devis. Avec l&apos;indicatif (+261 34 12 345 67) ou au
              format local (034 12 345 67).
            </p>
          </div>
          <div>
            <label className="etiquette" htmlFor="telephone">Téléphone affiché *</label>
            <input
              id="telephone"
              name="telephone"
              required
              inputMode="tel"
              defaultValue={actuels.telephone}
              className="champ"
            />
            <p className="mt-1 text-meta text-dim">
              Bouton « Appeler » de la page Contact, écrit tel que vous le saisissez.
            </p>
          </div>
        </section>

        <section className="carte space-y-3 p-4">
          <h2 className="text-[17px] font-semibold">Le local</h2>
          <div>
            <label className="etiquette" htmlFor="adresse">Adresse *</label>
            <textarea
              id="adresse"
              name="adresse"
              required
              rows={2}
              defaultValue={actuels.adresse}
              className="champ py-2.5"
            />
            <p className="mt-1 text-meta text-dim">Sert aussi au lien « Ouvrir dans Google Maps ».</p>
          </div>
        </section>

        <section className="carte p-4">
          <h2 className="text-[17px] font-semibold">Horaires</h2>
          <p className="mt-1 text-meta text-dim">
            Une ligne par période, dans l&apos;ordre d&apos;affichage. Laissez vides les lignes inutiles.
          </p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2">
            <span className="etiquette mb-0">Jours</span>
            <span className="etiquette mb-0">Heures</span>
            {horaires.map((l, i) => (
              <div key={i} className="contents">
                <input
                  name="jours"
                  aria-label={`Jours, ligne ${i + 1}`}
                  defaultValue={l.jours}
                  placeholder={i === 0 ? "Lundi – vendredi" : ""}
                  className="champ"
                />
                <input
                  name="heures"
                  aria-label={`Heures, ligne ${i + 1}`}
                  defaultValue={l.heures}
                  placeholder={i === 0 ? "8 h 30 – 17 h 30" : ""}
                  className="champ"
                />
              </div>
            ))}
          </div>
        </section>

        <button type="submit" className="btn-or w-full" disabled={etat === "table-absente"}>
          Enregistrer
        </button>
      </form>
    </div>
  );
}
