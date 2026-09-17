import Link from "next/link";
import { db } from "@/lib/db";
import { ar, dateFr, joursAvant } from "@/lib/format";
import { LIBELLE_VUE, estPublic } from "@/lib/types";
import { verrouPublication } from "@/lib/publication";
import { dansPeriode } from "@/lib/periodes";
import { lienConversation } from "@/lib/whatsapp";
import { Bandeau, EntetePage, Pastille, VideAdmin } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function TableauDeBord() {
  const pilote = db();
  const [motos, demandes] = await Promise.all([pilote.listerMotosAdmin(), pilote.listerDemandes()]);

  // Le verrou de publication est rejoué ici pour trier les brouillons : celui
  // qui ne demande plus qu'un clic ne doit pas être noyé parmi ceux auxquels
  // il manque encore la moitié du plan de prise de vue.
  const brouillons = await Promise.all(
    motos
      .filter((m) => m.statut === "brouillon")
      .map(async (m) => {
        const verrou = verrouPublication(m, await pilote.mediasDeMoto(m.id), "disponible");
        return { ...m, pret: verrou.autorise, bloquants: verrou.bloquants };
      })
  );
  const prets = brouillons.filter((b) => b.pret);
  const enCours = brouillons.filter((b) => !b.pret);

  // Une fiche publiée à qui il manque des vues est d'une autre nature qu'un
  // brouillon incomplet : elle est déjà devant les clients.
  const publieesIncompletes = motos.filter(
    (m) => estPublic(m.statut) && m.vues_manquantes.length > 0
  );

  const nouvelles = demandes.filter((d) => d.statut === "nouveau");
  const prixExpirants = motos
    .filter((m) => estPublic(m.statut) && m.statut !== "vendu")
    .map((m) => ({ ...m, jours: joursAvant(m.prix_valable_jusqu_au) }))
    .filter((m) => m.jours <= 7)
    .sort((a, b) => a.jours - b.jours);

  // Le mois se compte à l'heure d'Antananarivo, pas à celle du serveur : une
  // demande reçue entre minuit et 3 h du matin le 1er tombait sinon sur le
  // mois précédent.
  const duMois = demandes.filter((d) => dansPeriode(d.created_at, "mois"));
  const enLigne = motos.filter((m) => estPublic(m.statut)).length;

  const compteurs = [
    { libelle: "Demandes ce mois", valeur: duMois.length, href: "/admin/demandes" },
    { libelle: "RDV fixés", valeur: duMois.filter((d) => d.statut === "rdv_fixe").length, href: "/admin/demandes?statut=rdv_fixe" },
    { libelle: "Contrats signés", valeur: duMois.filter((d) => d.statut === "contrat_signe").length, href: "/admin/demandes?statut=contrat_signe" },
    { libelle: "Motos en ligne", valeur: enLigne, href: "/admin/motos?statut=en_ligne" },
  ];

  if (!motos.length) {
    return (
      <div>
        <EntetePage titre="Bienvenue" sousTitre="Le catalogue est vide. Voici par où commencer." />
        <PriseEnMain />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <EntetePage
        titre="Tableau de bord"
        sousTitre={`${enLigne} moto${enLigne > 1 ? "s" : ""} en ligne · objectif de recette : 8 à 12 fiches complètes.`}
      >
        <Link href="/admin/motos/nouvelle" className="btn-or px-4">
          + Nouvelle moto
        </Link>
      </EntetePage>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {compteurs.map((c) => (
          <Link key={c.libelle} href={c.href} className="carte p-3.5 transition-colors hover:border-gold/50">
            <p className="text-[30px] font-extrabold leading-none text-gold-light">{c.valeur}</p>
            <p className="mt-1 text-meta text-chrome">{c.libelle}</p>
          </Link>
        ))}
      </div>

      {/* Ordre volontaire : ce qui est cassé devant le public, puis ce qui est
          prêt à partir, puis ce qui attend une réponse, puis le reste. */}
      {publieesIncompletes.length ? (
        <Bandeau ton="alerte" titre="Publiées avec des vues manquantes">
          <p className="mt-1 text-meta text-chrome">
            Ces fiches sont visibles des clients alors qu&apos;il manque des angles du plan de prise
            de vue. Complétez-les ou repassez-les en brouillon.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {publieesIncompletes.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/motos/${m.id}?onglet=photos`} className="min-w-0">
                  <span className="block truncate text-corps font-medium">
                    {m.reference} · {m.marque} {m.modele}
                  </span>
                  <span className="block truncate text-meta text-dim">
                    {m.etat} · manque {m.vues_manquantes.map((v) => LIBELLE_VUE[v]).join(", ")}
                  </span>
                </Link>
                <span className="shrink-0 rounded-card bg-vendu/20 px-2.5 py-1 text-badge font-semibold text-vendu">
                  {m.vues_manquantes.length} vue{m.vues_manquantes.length > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Bandeau>
      ) : null}

      {prets.length ? (
        <Bandeau ton="action" titre="Prêtes à publier">
          <p className="mt-1 text-meta text-chrome">
            Tous les contrôles sont au vert. Il ne reste qu&apos;à basculer le statut.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {prets.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/motos/${m.id}`} className="min-w-0">
                  <span className="block truncate text-corps font-medium">
                    {m.reference} · {m.marque} {m.modele}
                  </span>
                  <span className="block text-meta text-dim">
                    {ar(m.prix_ttc)} · {m.nb_photos} photos
                  </span>
                </Link>
                <Link href={`/admin/motos/${m.id}`} className="btn-or shrink-0 px-3 text-[12px]">
                  Publier
                </Link>
              </li>
            ))}
          </ul>
        </Bandeau>
      ) : null}

      <Bandeau
        ton={nouvelles.length ? "action" : "neutre"}
        titre="Demandes non traitées"
        action={{ libelle: "Tout voir →", href: "/admin/demandes" }}
      >
        {nouvelles.length ? (
          <ul className="mt-2 divide-y divide-line">
            {nouvelles.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-corps font-medium">
                    {d.reference ?? "Demande générale"} · {d.nom ?? "sans nom"}
                  </span>
                  <span className="block text-meta text-dim">
                    {dateFr(d.created_at)} · source {d.source}
                    {d.budget_max ? ` · budget ${ar(d.budget_max)}` : ""}
                  </span>
                </span>
                {d.telephone ? (
                  <a
                    href={lienConversation(d.telephone, "Bonjour, ici MOTO IMPORT.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-fantome shrink-0 px-3 text-[12px]"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-corps text-dim">Aucune demande en attente.</p>
        )}
      </Bandeau>

      <Bandeau ton={prixExpirants.length ? "action" : "neutre"} titre="Prix arrivant à échéance (7 jours)">
        {prixExpirants.length ? (
          <ul className="mt-3 divide-y divide-line">
            {prixExpirants.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/motos/${m.id}`} className="min-w-0">
                  <span className="block truncate text-corps font-medium">
                    {m.reference} · {m.marque} {m.modele}
                  </span>
                  <span className="block text-meta text-dim">
                    {ar(m.prix_ttc)} · valable jusqu&apos;au {dateFr(m.prix_valable_jusqu_au)}
                  </span>
                </Link>
                <span
                  className={`shrink-0 rounded-card px-2.5 py-1 text-badge font-semibold ${
                    m.jours < 0 ? "bg-vendu/20 text-vendu" : "bg-gold/20 text-gold-light"
                  }`}
                >
                  {m.jours < 0 ? `expiré depuis ${-m.jours} j` : `J-${m.jours}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-corps text-dim">Aucun prix n&apos;expire dans les 7 jours.</p>
        )}
      </Bandeau>

      {enCours.length ? (
        <Bandeau titre="Brouillons en cours">
          <p className="mt-1 text-meta text-dim">
            Non visibles du public. Le détail de ce qui manque est sur l&apos;onglet Photos de
            chaque fiche.
          </p>
          <ul className="mt-3 divide-y divide-line">
            {enCours.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/admin/motos/${m.id}?onglet=photos`} className="min-w-0">
                  <span className="block truncate text-corps font-medium">
                    {m.reference} · {m.marque} {m.modele}
                  </span>
                  <span className="block truncate text-meta text-dim">
                    {m.bloquants[0] ?? "à compléter"}
                  </span>
                </Link>
                <span className="shrink-0 text-meta text-dim">
                  {m.bloquants.length} point{m.bloquants.length > 1 ? "s" : ""}
                  <Pastille n={m.nb_photos} ton="calme" />
                </span>
              </li>
            ))}
          </ul>
        </Bandeau>
      ) : null}
    </div>
  );
}

/** Écran d'accueil quand rien n'existe encore : les trois premiers gestes. */
function PriseEnMain() {
  const etapes = [
    {
      titre: "Créer une première fiche",
      texte:
        "Elle naît en brouillon, invisible du public. Vous pouvez la remplir en plusieurs fois sans rien exposer.",
      action: { libelle: "Nouvelle moto", href: "/admin/motos/nouvelle", principal: true },
    },
    {
      titre: "Ou importer un tableur",
      texte:
        "Vingt fiches d'un coup depuis un CSV, avant même d'avoir les photos. Un modèle est téléchargeable depuis l'écran d'import.",
      action: { libelle: "Import CSV", href: "/admin/import", principal: false },
    },
    {
      titre: "Puis déposer les photos en masse",
      texte:
        "Renommez les fichiers MI-001_01_34ad.jpg et déposez-les tous ensemble : ils se rangent seuls sous la bonne moto, dans le bon ordre.",
      action: { libelle: "Import photos", href: "/admin/import?onglet=photos", principal: false },
    },
  ];

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {etapes.map((e, i) => (
          <li key={e.titre} className="carte flex flex-wrap items-start gap-4 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold text-[15px] font-bold text-gold-light">
              {i + 1}
            </span>
            <span className="min-w-[220px] flex-1">
              <span className="block text-corps font-semibold">{e.titre}</span>
              <span className="mt-1 block text-meta text-chrome">{e.texte}</span>
            </span>
            <Link
              href={e.action.href}
              className={`${e.action.principal ? "btn-or" : "btn-fantome"} shrink-0 px-4`}
            >
              {e.action.libelle}
            </Link>
          </li>
        ))}
      </ol>
      <VideAdmin
        titre="Une fiche ne part en ligne que complète"
        texte="Trois angles exigés — 3/4 avant droit en couverture, 3/4 arrière gauche, face avant —, une description même brève et un prix daté. Les autres vues sont facultatives et le nombre de photos est libre. Tant qu'un de ces points manque, le statut ne peut pas passer en vente."
      />
    </div>
  );
}
