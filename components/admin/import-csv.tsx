"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CSV_MODELE } from "@/lib/csv";
import type { ErreurLigne } from "@/lib/import-csv";

type Resultat = {
  ok?: boolean;
  erreur?: string;
  erreurs?: ErreurLigne[];
  total?: number;
  crees?: number;
  mis_a_jour?: number;
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

  const telechargerModele = () => {
    const blob = new Blob([CSV_MODELE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-motos.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="carte p-5">
      <h2 className="text-[17px] font-semibold">Import de motos par CSV</h2>
      <p className="mt-1.5 text-corps text-chrome">
        Une référence déjà présente déclenche une mise à jour, jamais un doublon.{" "}
        <strong className="text-text">
          Si une seule ligne est invalide, rien n&apos;est écrit
        </strong>{" "}
        et le rapport indique la ligne et la colonne fautives.
      </p>

      <button type="button" onClick={telechargerModele} className="mt-3 text-[12.5px] font-semibold text-gold-light underline">
        Télécharger le modèle CSV
      </button>

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
          Import réussi : {resultat.crees} moto(s) créée(s), {resultat.mis_a_jour} mise(s) à jour sur{" "}
          {resultat.total} ligne(s).
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
