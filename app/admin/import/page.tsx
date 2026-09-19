import Link from "next/link";
import { db } from "@/lib/db";
import { dateFr } from "@/lib/format";
import { ImportCsv } from "@/components/admin/import-csv";
import { ImportPhotos } from "@/components/admin/import-photos";
import { BarreFiltres, EntetePage, PuceFiltre } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const ONGLETS = [
  { cle: "csv", libelle: "Motos (CSV)" },
  { cle: "photos", libelle: "Photos (masse)" },
];

export default async function PageImport({
  searchParams,
}: {
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { onglet = "csv" } = await searchParams;
  const pilote = db();
  const [motos, lots] = await Promise.all([pilote.listerMotosAdmin(), pilote.listerLots()]);

  return (
    <div>
      <EntetePage
        titre="Import"
        sousTitre="Trois étapes : 1. le CSV crée les fiches, toutes en brouillon ; 2. l'import photos les range par référence, d'après le nom des fichiers ; 3. la liste des motos publie d'un coup les brouillons prêts."
      />

      <BarreFiltres legende="Type d'import">
        {ONGLETS.map((o) => (
          <PuceFiltre key={o.cle} href={`/admin/import?onglet=${o.cle}`} actif={onglet === o.cle}>
            {o.libelle}
          </PuceFiltre>
        ))}
      </BarreFiltres>

      {onglet === "photos" ? (
        <ImportPhotos
          motos={motos.map((m) => ({
            id: m.id,
            reference: m.reference,
            marque: m.marque,
            modele: m.modele,
            annee: m.annee,
            etat: m.etat,
            date_photos: m.date_photos,
          }))}
        />
      ) : (
        <ImportCsv />
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-[17px] font-semibold">Historique des lots</h2>
        {lots.length ? (
          <ul className="space-y-2">
            {lots.slice(0, 20).map((l) => (
              <li key={l.id} className="carte flex flex-wrap items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  <span className="block truncate text-corps font-medium">
                    {l.type === "motos_csv" ? "CSV motos" : "Photos en masse"} ·{" "}
                    {l.fichier_nom ?? "sans nom"}
                  </span>
                  <span className="block text-meta text-dim">
                    {dateFr(l.created_at)} · {l.reussis} réussi(s)
                    {l.echoues ? ` · ${l.echoues} échec(s)` : ""} sur {l.total}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-card px-2.5 py-1 text-badge font-semibold ${
                    l.echoues ? "bg-vendu/20 text-vendu" : "bg-dispo/20 text-dispo"
                  }`}
                >
                  {l.echoues ? "avec échecs" : "OK"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="carte p-4 text-corps text-dim">Aucun import réalisé pour l&apos;instant.</p>
        )}
      </section>
    </div>
  );
}
