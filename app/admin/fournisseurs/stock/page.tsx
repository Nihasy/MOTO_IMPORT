import Link from "next/link";
import { db } from "@/lib/db";
import { sessionCourante } from "@/lib/auth";
import { dateFr } from "@/lib/format";
import { filigraneIncruste, urlMedia } from "@/lib/cloudinary";
import { LIBELLE_STOCK, descriptionCourte, motosDuStock } from "@/lib/stock-fournisseur";
import { BoutonImprimer } from "@/components/admin/bouton-imprimer";
import { EntetePage } from "@/components/admin/ui";
import { Filigrane } from "@/components/ui/filigrane";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fiche de stock fournisseur" };

const nombre = (n: number) => n.toLocaleString("fr-FR");

/**
 * Fiche de stock d'un fournisseur, à lui envoyer pour qu'il coche ce qu'il a
 * encore. Écran et papier partagent la même feuille blanche : ce qui s'affiche
 * est exactement ce qui s'imprime. Les fournisseurs lisent le chinois, d'où
 * les intitulés doublés.
 */
export default async function PageStockFournisseur({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const session = await sessionCourante();
  if (session?.role !== "admin") {
    return (
      <div className="carte p-6">
        <h1 className="text-titre-fiche">Accès refusé</h1>
        <p className="mt-2 text-corps text-chrome">Réservé au compte administrateur.</p>
      </div>
    );
  }

  const { f } = await searchParams;
  const pilote = db();
  const [fournisseurs, motos] = await Promise.all([pilote.listerFournisseurs(), pilote.listerMotosAdmin()]);
  const fournisseur = fournisseurs.find((x) => x.id === f) ?? null;
  const stock = fournisseur ? motosDuStock(motos, fournisseur.id) : [];
  const enVente = stock.filter((m) => m.statut !== "vendu").length;

  return (
    <div>
      <div className="print:hidden">
        <EntetePage
          titre="Fiche de stock"
          sousTitre="Les motos proposées sur commande, fournisseur par fournisseur : en vente, réservées et vendues. Les brouillons et les motos déjà au local n'y figurent pas."
        />
        <form method="get" className="carte mt-4 flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1">
            <label className="etiquette" htmlFor="f">Fournisseur</label>
            <select id="f" name="f" defaultValue={fournisseur?.id ?? ""} className="champ">
              <option value="" disabled>Choisir un fournisseur…</option>
              {fournisseurs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nom}
                  {x.contact ? ` (${x.contact})` : ""}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-fantome px-4">Afficher</button>
          {fournisseur && stock.length ? <BoutonImprimer /> : null}
          <Link href="/admin/fournisseurs" className="btn-fantome px-4">← Fournisseurs</Link>
        </form>
      </div>

      {!fournisseur ? (
        <p className="carte mt-4 p-6 text-center text-corps text-dim print:hidden">
          Choisissez un fournisseur pour afficher sa fiche.
        </p>
      ) : (
        <article className="feuille-stock mx-auto mt-5 max-w-[210mm] bg-white p-[10mm] text-[11pt] leading-snug text-neutral-900 print:mt-0 print:max-w-none print:p-0">
          <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-neutral-900 pb-2">
            <div>
              <h1 className="text-[18pt] font-bold">
                Fiche de stock <span className="font-normal text-neutral-500">· 库存核对表</span>
              </h1>
              <p className="text-[12pt] font-semibold">
                {fournisseur.nom}
                {fournisseur.contact ? <span className="font-normal"> · WeChat {fournisseur.contact}</span> : null}
              </p>
            </div>
            <p className="text-right text-[9.5pt] text-neutral-600">
              MOTO IMPORT · {dateFr(new Date())}
              <br />
              {stock.length} moto{stock.length > 1 ? "s" : ""} · {enVente} en vente
            </p>
          </header>

          <p className="mt-2 text-[9.5pt] text-neutral-600">
            Cochez l&apos;état réel de chaque moto chez vous. · 请勾选每辆车的实际状态。
          </p>

          {stock.length === 0 ? (
            <p className="py-10 text-center text-neutral-500">Aucune moto sur commande pour ce fournisseur.</p>
          ) : (
            <table className="mt-3 w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-400 text-[9pt] uppercase tracking-wide text-neutral-600">
                  <th className="w-[34%] py-1.5 pr-2 font-semibold">Visuel · 图片</th>
                  <th className="py-1.5 pr-2 font-semibold">Informations · 信息</th>
                  <th className="w-[24%] py-1.5 font-semibold">Statut · 状态</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((m) => {
                  const photo = m.couverture;
                  const libelle = LIBELLE_STOCK[m.statut];
                  return (
                    <tr key={m.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                      <td className="py-2 pr-3">
                        {photo ? (
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-200">
                            {/* eslint-disable-next-line @next/next/no-img-element -- le document part
                                à l'impression : une <img> nue se charge sans l'optimiseur, que
                                la boîte d'impression n'attend pas. */}
                            <img
                              src={urlMedia(photo.cloudinary_id, "carte", { origine: photo.origine })}
                              alt={`${m.marque} ${m.modele}`}
                              className="h-full w-full object-cover"
                            />
                            {/* Le document sort du back-office : il porte la marque comme
                                toute image publiée. */}
                            {filigraneIncruste(photo.cloudinary_id, "carte") ? null : <Filigrane />}
                          </div>
                        ) : (
                          <div className="flex aspect-[4/3] w-full items-center justify-center bg-neutral-100 text-[9pt] text-neutral-400">
                            Sans photo
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <p className="text-[12pt] font-bold">
                          {m.marque} {m.modele}
                        </p>
                        <p className="font-mono text-[10pt] font-semibold">{m.reference}</p>
                        <p className="mt-0.5 text-[10pt]">
                          {m.annee}
                          {m.kilometrage != null ? ` · ${nombre(m.kilometrage)} km` : ""}
                          <span className="text-neutral-500">
                            {" "}
                            · {m.annee}年{m.kilometrage != null ? ` · ${nombre(m.kilometrage)} 公里` : ""}
                          </span>
                        </p>
                        {m.description ? (
                          <p className="mt-1 text-[9.5pt] text-neutral-700">{descriptionCourte(m.description)}</p>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <p
                          className={`inline-block rounded px-1.5 py-0.5 text-[9.5pt] font-semibold ${
                            m.statut === "vendu"
                              ? "bg-neutral-800 text-white"
                              : m.statut === "reserve"
                                ? "bg-neutral-300 text-neutral-900"
                                : "border border-neutral-800"
                          }`}
                        >
                          {libelle.fr} · {libelle.zh}
                        </p>
                        <ul className="mt-2.5 space-y-2 text-[10.5pt]">
                          <li className="flex items-center gap-2">
                            <span className="inline-block h-[4.5mm] w-[4.5mm] shrink-0 border-[1.5px] border-neutral-900" />
                            Disponible · 有货
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="inline-block h-[4.5mm] w-[4.5mm] shrink-0 border-[1.5px] border-neutral-900" />
                            Vendu · 已售
                          </li>
                        </ul>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <section className="mt-4 break-inside-avoid">
            <p className="text-[10pt] font-semibold">
              Remarques, autres motos disponibles · 备注，其他可售车辆
            </p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[8mm] border-b border-neutral-400" />
            ))}
          </section>
        </article>
      )}
    </div>
  );
}
