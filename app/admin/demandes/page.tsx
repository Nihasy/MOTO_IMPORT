import { db } from "@/lib/db";
import { ar, dateFr } from "@/lib/format";
import { DEMANDE_SOURCES, DEMANDE_STATUTS, LIBELLE_DEMANDE_STATUT } from "@/lib/types";
import { PERIODES, dansPeriode, estPeriode, type Periode } from "@/lib/periodes";
import { lienConversation } from "@/lib/whatsapp";
import { majDemande } from "@/app/admin/actions";
import { ExportDemandes } from "@/components/admin/export-demandes";
import { BarreFiltres, EntetePage, PuceFiltre, VideAdmin } from "@/components/admin/ui";
import { CarteKanban } from "@/components/admin/carte-kanban";

export const dynamic = "force-dynamic";

type Params = { vue?: string; source?: string; statut?: string; periode?: string };

export default async function PageDemandes({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const sp = await searchParams;
  const vue = sp.vue === "kanban" ? "kanban" : "liste";
  const periode: Periode = estPeriode(sp.periode) ? sp.periode : "tout";
  const source = DEMANDE_SOURCES.includes(sp.source as never) ? sp.source : undefined;
  const statut = DEMANDE_STATUTS.includes(sp.statut as never) ? sp.statut : undefined;

  const toutes = await db().listerDemandes();

  // Les effectifs des puces se calculent sur le jeu filtré par les *autres*
  // critères : sinon, sélectionner une source faisait disparaître toutes les
  // autres puces, et on ne pouvait plus en changer sans revenir à zéro.
  const parPeriode = toutes.filter((d) => dansPeriode(d.created_at, periode));
  const demandes = parPeriode.filter(
    (d) => (!source || d.source === source) && (!statut || d.statut === statut)
  );

  const lien = (patch: Partial<Params>) => {
    const p = new URLSearchParams();
    const suivant = { vue, periode, source, statut, ...patch };
    if (suivant.vue === "kanban") p.set("vue", "kanban");
    if (suivant.periode && suivant.periode !== "tout") p.set("periode", suivant.periode);
    if (suivant.source) p.set("source", suivant.source);
    if (suivant.statut) p.set("statut", suivant.statut);
    const s = p.toString();
    return s ? `/admin/demandes?${s}` : "/admin/demandes";
  };

  return (
    <div>
      <EntetePage
        titre="Demandes"
        compte={demandes.length}
        sousTitre="Chaque clic sur « Demander le devis » crée une ligne ici, avant même que le visiteur n'écrive sur WhatsApp. Le champ source est ce qui permet d'arbitrer le budget publicitaire."
      >
        <ExportDemandes demandes={demandes} />
      </EntetePage>

      <BarreFiltres legende="Vue">
        <PuceFiltre href={lien({ vue: "liste" })} actif={vue === "liste"}>
          Liste
        </PuceFiltre>
        <PuceFiltre href={lien({ vue: "kanban" })} actif={vue === "kanban"}>
          Kanban
        </PuceFiltre>
      </BarreFiltres>

      <BarreFiltres legende="Période">
        {(Object.keys(PERIODES) as Periode[]).map((p) => (
          <PuceFiltre
            key={p}
            href={lien({ periode: p })}
            actif={periode === p}
            compte={toutes.filter((d) => dansPeriode(d.created_at, p)).length}
          >
            {PERIODES[p]}
          </PuceFiltre>
        ))}
      </BarreFiltres>

      <BarreFiltres legende="Source">
        <PuceFiltre href={lien({ source: undefined })} actif={!source} compte={parPeriode.length}>
          Toutes
        </PuceFiltre>
        {DEMANDE_SOURCES.map((s) => (
          <PuceFiltre
            key={s}
            href={lien({ source: source === s ? undefined : s })}
            actif={source === s}
            compte={parPeriode.filter((d) => d.source === s).length}
          >
            {s.replace(/_/g, " ")}
          </PuceFiltre>
        ))}
      </BarreFiltres>

      {vue === "liste" ? (
        <BarreFiltres legende="Statut">
          <PuceFiltre href={lien({ statut: undefined })} actif={!statut} compte={parPeriode.length}>
            Tous
          </PuceFiltre>
          {DEMANDE_STATUTS.map((s) => (
            <PuceFiltre
              key={s}
              href={lien({ statut: statut === s ? undefined : s })}
              actif={statut === s}
              compte={parPeriode.filter((d) => d.statut === s).length}
            >
              {LIBELLE_DEMANDE_STATUT[s]}
            </PuceFiltre>
          ))}
        </BarreFiltres>
      ) : null}

      <div className="mt-4">
        {vue === "kanban" ? (
          <div className="grid gap-3 md:grid-cols-5">
            {DEMANDE_STATUTS.map((s) => {
              const colonne = demandes.filter((d) => d.statut === s);
              return (
                <section key={s} className="carte p-3">
                  <h2 className="text-[12.5px] font-semibold uppercase tracking-wide text-gold-light">
                    {LIBELLE_DEMANDE_STATUT[s]}{" "}
                    <span className="text-dim">({colonne.length})</span>
                  </h2>
                  <ul className="mt-2 space-y-2">
                    {colonne.map((d) => (
                      <li key={d.id}>
                        <CarteKanban demande={d} />
                      </li>
                    ))}
                    {colonne.length === 0 ? (
                      <li className="py-3 text-center text-[11.5px] text-dim">—</li>
                    ) : null}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : demandes.length ? (
          <ul className="space-y-2">
            {demandes.map((d) => (
              <li key={d.id} className="carte p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-corps font-semibold">
                      {d.reference ?? "Demande générale"} · {d.nom ?? "sans nom"}
                    </p>
                    <p className="text-meta text-dim">
                      {dateFr(d.created_at)} · source {d.source}
                      {d.telephone ? ` · ${d.telephone}` : ""}
                      {d.budget_max ? ` · budget ${ar(d.budget_max)}` : ""}
                    </p>
                    {d.message ? <p className="mt-1.5 text-corps text-chrome">{d.message}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-card bg-surface-hi px-2.5 py-1 text-badge font-semibold text-chrome">
                      {LIBELLE_DEMANDE_STATUT[d.statut]}
                    </span>
                    {d.telephone ? (
                      <a
                        href={lienConversation(
                          d.telephone,
                          `Bonjour, ici MOTO IMPORT au sujet de ${d.reference ?? "votre demande"}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-fantome px-3 text-[12px]"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                </div>

                <form action={majDemande} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <div>
                    <label className="etiquette" htmlFor={`statut-${d.id}`}>
                      Statut
                    </label>
                    <select
                      id={`statut-${d.id}`}
                      name="statut"
                      defaultValue={d.statut}
                      className="champ w-auto"
                    >
                      {DEMANDE_STATUTS.map((x) => (
                        <option key={x} value={x}>
                          {LIBELLE_DEMANDE_STATUT[x]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[200px] flex-1">
                    <label className="etiquette" htmlFor={`notes-${d.id}`}>
                      Notes
                    </label>
                    <input
                      id={`notes-${d.id}`}
                      name="notes"
                      defaultValue={d.notes ?? ""}
                      placeholder="RDV samedi 10h, cherche un trail 400"
                      className="champ"
                    />
                  </div>
                  <button type="submit" className="btn-fantome px-4">
                    Enregistrer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <VideAdmin
            titre="Aucune demande dans ce filtre"
            texte={
              toutes.length
                ? "Élargissez la période ou retirez un filtre pour retrouver les autres demandes."
                : "Chaque clic sur « Demander le devis » en créera une, avant même que le visiteur n'écrive sur WhatsApp."
            }
          />
        )}
      </div>
    </div>
  );
}
