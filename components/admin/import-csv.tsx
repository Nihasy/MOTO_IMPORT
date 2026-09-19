"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COLONNES_CSV, CSV_MODELE, CSV_MODELE_VIDE } from "@/lib/csv";
import type { ErreurLigne } from "@/lib/import-csv";

type Resultat = {
  ok?: boolean;
  erreur?: string;
  erreurs?: ErreurLigne[];
  total?: number;
  crees?: number;
  mis_a_jour?: number;
  sans_prix?: number;
  retenus_en_brouillon?: number;
};

export function ImportCsv() {
  const router = useRouter();
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  const envoyer = async () => {
    if (!csv) return;
    setEnCours(true);
    setResultat(null);
    const rep = await fetch("/api/import/motos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, fichier_nom: nomFichier }),
    });
    setResultat((await rep.json().catch(() => ({ erreur: "Réponse illisible" }))) as Resultat);
    setEnCours(false);
    if (rep.ok) router.refresh();
  };

  // Le BOM UTF-8 fait lire les accents correctement à Excel ; sans lui,
  // « Modèle » s'affiche « ModÃ¨le ».
  const telecharger = (contenu: string, nom: string) => {
    const blob = new Blob(["\uFEFF" + contenu], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="carte p-5">
      <h2 className="text-[17px] font-semibold">Import de motos par CSV</h2>
      <p className="mt-1.5 text-corps text-chrome">
        <strong className="text-text">Chaque fiche importée naît en brouillon</strong>, invisible du
        public. Ajoutez ensuite ses photos (onglet « Photos »), puis publiez depuis la liste des motos.
        Une référence déjà présente met la fiche à jour sans changer son statut, jamais un doublon.{" "}
        <strong className="text-text">
          Si une seule ligne est invalide, rien n&apos;est écrit
        </strong>{" "}
        et le rapport indique la ligne et la colonne fautives.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => telecharger(CSV_MODELE_VIDE, "modele-motos-vide.csv")} className="btn-fantome px-4">
          Modèle vide (.csv)
        </button>
        <button type="button" onClick={() => telecharger(CSV_MODELE, "modele-motos-exemples.csv")} className="btn-fantome px-4">
          Modèle avec 2 exemples
        </button>
      </div>
      <p className="mt-2 text-meta text-dim">
        S&apos;ouvre dans Excel, LibreOffice ou Google Sheets. Enregistrez au format CSV : virgules ou
        points-virgules, dates en 31/12/2026 ou 2026-12-31, les deux sont acceptés.
      </p>

      <details className="mt-3 rounded-card border border-line bg-surface-hi">
        <summary className="cursor-pointer px-3 py-2.5 text-corps font-semibold text-text">
          Guide des colonnes ({COLONNES_CSV.filter((c) => c.obligatoire).length} obligatoires)
        </summary>
        <div className="max-h-80 overflow-auto border-t border-line">
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 bg-surface-hi text-dim">
              <tr>
                <th className="px-3 py-1.5">Colonne</th>
                <th className="px-3 py-1.5">Attendu</th>
                <th className="px-3 py-1.5">Exemple</th>
              </tr>
            </thead>
            <tbody className="text-chrome">
              {COLONNES_CSV.map((c) => (
                <tr key={c.nom} className="border-t border-line/60 align-top">
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-text">
                    {c.nom}
                    {c.obligatoire ? <span className="text-gold-light"> *</span> : null}
                  </td>
                  <td className="px-3 py-1.5">{c.format}</td>
                  <td className="px-3 py-1.5 text-dim">{c.exemple}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <label className="mt-4 flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-line bg-surface-hi text-center hover:border-gold">
        <span className="text-corps font-semibold text-gold-light">
          {nomFichier ?? "Choisir un fichier .csv"}
        </span>
        <span className="text-meta text-dim">UTF-8, séparateur virgule</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setNomFichier(f.name);
            setCsv(await f.text());
            setResultat(null);
          }}
        />
      </label>

      {csv ? (
        <button type="button" className="btn-or mt-3 w-full" disabled={enCours} onClick={() => void envoyer()}>
          {enCours ? "Validation et import…" : "Valider et importer"}
        </button>
      ) : null}

      {resultat?.ok ? (
        <p role="status" className="mt-4 rounded-card border border-dispo/50 bg-dispo/10 px-3 py-2.5 text-corps text-dispo">
          Import réussi : {resultat.crees} moto(s) créée(s) en brouillon, {resultat.mis_a_jour} mise(s) à
          jour sur {resultat.total} ligne(s).
          {resultat.sans_prix ? (
            <span className="mt-1 block text-gold-light">
              {resultat.sans_prix} fiche(s) sans prix d&apos;achat en ¥ : à compléter avant publication.
            </span>
          ) : null}
          {resultat.retenus_en_brouillon ? (
            <span className="mt-1 block text-gold-light">
              {resultat.retenus_en_brouillon} fiche(s) déjà en vente repassée(s) en brouillon : la mise à
              jour les rendait incomplètes.
            </span>
          ) : null}
          <span className="mt-2 flex flex-wrap gap-2">
            <Link href="/admin/import?onglet=photos" className="btn-or px-4">
              Étape suivante : importer les photos
            </Link>
            <Link href="/admin/motos?statut=brouillon" className="btn-fantome px-4">
              Voir les brouillons
            </Link>
          </span>
        </p>
      ) : null}

      {resultat && !resultat.ok ? (
        <div role="alert" className="mt-4 rounded-card border border-vendu/50 bg-vendu/10 p-3">
          <p className="text-corps font-semibold text-vendu">{resultat.erreur}</p>
          {resultat.erreurs?.length ? (
            <div className="mt-2 max-h-64 overflow-y-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-dim">
                  <tr>
                    <th className="py-1 pr-2">Ligne</th>
                    <th className="py-1 pr-2">Colonne</th>
                    <th className="py-1">Motif</th>
                  </tr>
                </thead>
                <tbody className="text-chrome">
                  {resultat.erreurs.map((e, i) => (
                    <tr key={i} className="border-t border-line/60">
                      <td className="py-1 pr-2 font-semibold text-text">{e.ligne}</td>
                      <td className="py-1 pr-2">{e.colonne}</td>
                      <td className="py-1">
                        {e.message}
                        {e.valeur ? <span className="text-dim"> — « {e.valeur} »</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
