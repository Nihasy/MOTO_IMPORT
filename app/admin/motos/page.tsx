import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { ar, dateFr, estNouvelle } from "@/lib/format";
import { servieParCloudinary, urlMedia } from "@/lib/cloudinary";
import { LIBELLE_VUE } from "@/lib/types";
import {
  GROUPES_ADMIN, effectifsAdmin, estGroupeAdmin, filtrerMotosAdmin, type GroupeAdmin,
} from "@/lib/admin-filtres";
import { SelecteurStatut } from "@/components/admin/selecteur-statut";
import { BarreFiltres, EntetePage, PuceFiltre, VideAdmin } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; statut?: string }> };

export default async function ListeMotos({ searchParams }: Props) {
  const { q = "", statut } = await searchParams;

  // La couverture arrive avec la ligne : la réclamer moto par moto produisait
  // une requête par fiche.
  const toutes = await db().listerMotosAdmin();

  const groupe: GroupeAdmin = estGroupeAdmin(statut) ? statut : "tous";
  const effectifs = effectifsAdmin(toutes);
  const motos = filtrerMotosAdmin(toutes, { q, groupe });

  const lien = (g: GroupeAdmin) => {
    const p = new URLSearchParams();
    if (g !== "tous") p.set("statut", g);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/admin/motos?${s}` : "/admin/motos";
  };

  return (
    <div>
      <EntetePage
        titre="Motos"
        compte={toutes.length}
        sousTitre="Le statut se change ici, sans ouvrir la fiche. Une bascule vers la vente est refusée tant que les contrôles ne sont pas verts."
      >
        <Link href="/admin/import" className="btn-fantome px-4">
          Importer
        </Link>
        <Link href="/admin/motos/nouvelle" className="btn-or px-4">
          + Nouvelle moto
        </Link>
      </EntetePage>

      {toutes.length === 0 ? (
        <VideAdmin
          titre="Aucune moto au catalogue"
          texte="Créez une fiche à la main, ou importez un tableur pour en créer vingt d'un coup."
        >
          <Link href="/admin/motos/nouvelle" className="btn-or px-4">
            Créer une moto
          </Link>
          <Link href="/admin/import" className="btn-fantome px-4">
            Importer un CSV
          </Link>
        </VideAdmin>
      ) : (
        <>
          {/* Recherche en GET : l'URL porte le filtre, donc il survit à un
              rechargement et se partage entre les deux comptes. */}
          <form method="get" action="/admin/motos" className="mb-3 flex gap-2">
            {groupe !== "tous" ? <input type="hidden" name="statut" value={groupe} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Référence, marque, modèle, année…"
              aria-label="Rechercher une moto"
              className="champ flex-1"
            />
            <button type="submit" className="btn-fantome px-4">
              Chercher
            </button>
          </form>

          <BarreFiltres legende="Filtrer">
            {(Object.keys(GROUPES_ADMIN) as GroupeAdmin[]).map((g) => (
              <PuceFiltre key={g} href={lien(g)} actif={groupe === g} compte={effectifs[g]}>
                {GROUPES_ADMIN[g]}
              </PuceFiltre>
            ))}
          </BarreFiltres>

          {motos.length === 0 ? (
            <VideAdmin
              titre="Aucune fiche ne correspond"
              texte={
                q
                  ? `Rien pour « ${q} » dans ce filtre. Essayez une autre référence, ou élargissez à « Toutes ».`
                  : "Ce filtre ne contient aucune fiche."
              }
            >
              <Link href="/admin/motos" className="btn-fantome px-4">
                Réinitialiser
              </Link>
            </VideAdmin>
          ) : (
            <ul className="space-y-2">
              {motos.map((m) => {
                const manque = m.vues_manquantes.length > 0;
                const couverture = m.couverture
                  ? urlMedia(m.couverture.cloudinary_id, "vignette", { origine: m.couverture.origine })
                  : null;
                return (
                  <li key={m.id} className="carte p-3">
                    {/* Deux rangées sur téléphone : identité au-dessus, actions
                        en dessous. En une seule, le sélecteur de statut passait
                        à la ligne au milieu des badges. */}
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-[74px] shrink-0 overflow-hidden rounded bg-surface-hi">
                        {couverture ? (
                          <Image
                            src={couverture}
                            alt=""
                            fill
                            sizes="74px"
                            className="object-cover"
                            unoptimized={Boolean(m.couverture && servieParCloudinary(m.couverture.cloudinary_id))}
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center text-center text-[10px] leading-tight text-dim">
                            sans
                            <br />
                            photo
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/motos/${m.id}`}
                          className="block truncate text-corps font-semibold hover:text-gold-light"
                        >
                          {m.reference} · {m.marque} {m.modele} {m.annee}
                        </Link>
                        <p className="truncate text-meta text-dim">
                          {ar(m.prix_ttc)} · {m.etat} · maj {dateFr(m.updated_at)}
                        </p>
                        {estNouvelle(m.created_at) ? (
                          <span className="mt-1 inline-flex border-l-[3px] border-l-gold bg-bg px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none text-gold-light">
                            Nouveau
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-card px-2.5 py-1 text-badge font-semibold ${
                            manque ? "bg-vendu/20 text-vendu" : "bg-dispo/20 text-dispo"
                          }`}
                          title={
                            manque
                              ? `Vues manquantes : ${m.vues_manquantes.map((v) => LIBELLE_VUE[v]).join(", ")}`
                              : `Plan de prise de vue complet pour une moto ${m.etat}`
                          }
                        >
                          {m.nb_photos} photo{m.nb_photos > 1 ? "s" : ""}
                          {manque ? ` · ${m.vues_manquantes.length} vue${m.vues_manquantes.length > 1 ? "s" : ""} manquante${m.vues_manquantes.length > 1 ? "s" : ""}` : ""}
                        </span>
                        <Link
                          href={`/admin/motos/${m.id}?onglet=photos`}
                          className="text-[12px] font-semibold text-gold-light"
                        >
                          Photos →
                        </Link>
                      </div>
                      <SelecteurStatut id={m.id} statut={m.statut} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
