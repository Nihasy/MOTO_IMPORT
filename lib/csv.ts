/** Analyseur CSV minimal, tolerant aux guillemets et aux retours a la ligne encadres. */
export function parserCsv(texte: string): { entetes: string[]; lignes: Record<string, string>[] } {
  const propre = texte.replace(/^﻿/, "");
  const cellules: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let dansGuillemets = false;

  for (let i = 0; i < propre.length; i++) {
    const c = propre[i];
    if (dansGuillemets) {
      if (c === '"') {
        if (propre[i + 1] === '"') { champ += '"'; i++; }
        else dansGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"') { dansGuillemets = true; continue; }
    if (c === ",") { ligne.push(champ); champ = ""; continue; }
    if (c === "\n") { ligne.push(champ); cellules.push(ligne); ligne = []; champ = ""; continue; }
    if (c === "\r") continue;
    champ += c;
  }
  if (champ.length || ligne.length) { ligne.push(champ); cellules.push(ligne); }

  const nonVides = cellules.filter((l) => l.some((c) => c.trim() !== ""));
  if (!nonVides.length) return { entetes: [], lignes: [] };

  const entetes = nonVides[0].map((e) => e.trim());
  const lignes = nonVides.slice(1).map((l) => {
    const o: Record<string, string> = {};
    entetes.forEach((e, i) => { o[e] = (l[i] ?? "").trim(); });
    return o;
  });
  return { entetes, lignes };
}

export function versCsv(lignes: Record<string, unknown>[], entetes?: string[]): string {
  if (!lignes.length) return "";
  const cols = entetes ?? Object.keys(lignes[0]);
  const echapper = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...lignes.map((l) => cols.map((c) => echapper(l[c])).join(","))].join("\n");
}

export const COLONNES_MODELE = [
  "reference", "marque", "modele", "annee", "cylindree", "categorie", "etat",
  "kilometrage", "couleur", "puissance_ch", "poids_kg", "hauteur_selle_mm",
  "refroidissement", "transmission", "abs", "prix_yuan", "prix_valable_jusqu_au",
  "garantie_mois", "garantie_texte", "description", "points_forts", "fournisseur",
  "statut", "date_photos",
];

export const CSV_MODELE = [
  COLONNES_MODELE.join(","),
  [
    "MI-101", "Honda", "CB500X", "2023", "471", "trail", "neuf", "", "Rouge",
    "47", "199", "834", "liquide", "6 rapports", "true", "15000", "2026-12-31",
    "12", "Moteur et boite 12 mois", "\"Trail routier polyvalent, ideal Tana et RN.\"",
    "\"ABS de serie|Selle basse|Consommation contenue\"", "Guangzhou Moto Co", "disponible", "",
  ].join(","),
].join("\n");
