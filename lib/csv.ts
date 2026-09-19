/**
 * Séparateur du fichier, lu sur la ligne d'en-tête : Excel en français
 * enregistre les CSV avec des points-virgules, Google Sheets et LibreOffice
 * avec des virgules. Les deux sont acceptés, sans rien demander à l'utilisateur.
 */
function detecterSeparateur(texte: string): "," | ";" {
  const fin = texte.search(/\r?\n/);
  const entete = (fin < 0 ? texte : texte.slice(0, fin)).replace(/"[^"]*"/g, "");
  const pointsVirgules = (entete.match(/;/g) ?? []).length;
  const virgules = (entete.match(/,/g) ?? []).length;
  return pointsVirgules > virgules ? ";" : ",";
}

/** Analyseur CSV minimal, tolerant aux guillemets et aux retours a la ligne encadres. */
export function parserCsv(texte: string): { entetes: string[]; lignes: Record<string, string>[] } {
  const propre = texte.replace(/^﻿/, "");
  const separateur = detecterSeparateur(propre);
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
    if (c === separateur) { ligne.push(champ); champ = ""; continue; }
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

/**
 * Colonnes du modèle d'import, dans l'ordre du fichier : les obligatoires
 * d'abord. Une seule définition sert au fichier téléchargeable et au guide
 * affiché à côté de l'import.
 *
 * Pas de colonne `statut` : toute fiche importée naît en brouillon, et passe
 * en vente depuis le back-office une fois ses photos en place.
 */
export type ColonneCsv = { nom: string; obligatoire: boolean; format: string; exemple: string };

export const COLONNES_CSV: ColonneCsv[] = [
  { nom: "reference", obligatoire: true, format: "MI- suivi de 3 chiffres ou plus. Une référence existante met la fiche à jour", exemple: "MI-101" },
  { nom: "marque", obligatoire: true, format: "Texte", exemple: "Honda" },
  { nom: "modele", obligatoire: true, format: "Texte", exemple: "CB500X" },
  { nom: "annee", obligatoire: true, format: "Année sur 4 chiffres", exemple: "2023" },
  { nom: "cylindree", obligatoire: true, format: "En cm³, nombre entier", exemple: "471" },
  { nom: "categorie", obligatoire: true, format: "routiere, sportive, roadster, trail, custom, motocross ou scooter", exemple: "trail" },
  { nom: "etat", obligatoire: true, format: "neuf ou occasion", exemple: "neuf" },
  { nom: "prix_yuan", obligatoire: true, format: "Prix d'achat en ¥, nombre entier. Réservé à l'administrateur ; vide = fiche sans prix", exemple: "15000" },
  { nom: "prix_valable_jusqu_au", obligatoire: true, format: "Date : 31/12/2026 ou 2026-12-31", exemple: "31/12/2026" },
  { nom: "disponibilite", obligatoire: false, format: "commande (importée après signature) ou local (déjà à Tana, disponible de suite). Vide = commande", exemple: "commande" },
  { nom: "kilometrage", obligatoire: false, format: "Obligatoire pour une occasion, nombre entier", exemple: "" },
  { nom: "date_photos", obligatoire: false, format: "Obligatoire pour une occasion (CGV art. 3.4)", exemple: "" },
  { nom: "couleur", obligatoire: false, format: "Texte", exemple: "Rouge" },
  { nom: "puissance_ch", obligatoire: false, format: "En ch, nombre entier", exemple: "47" },
  { nom: "poids_kg", obligatoire: false, format: "En kg, nombre entier", exemple: "199" },
  { nom: "hauteur_selle_mm", obligatoire: false, format: "En mm, nombre entier", exemple: "834" },
  { nom: "refroidissement", obligatoire: false, format: "air ou liquide", exemple: "liquide" },
  { nom: "transmission", obligatoire: false, format: "Texte", exemple: "6 rapports" },
  { nom: "abs", obligatoire: false, format: "oui ou non", exemple: "oui" },
  { nom: "garantie_mois", obligatoire: false, format: "Neuf seulement, nombre de mois", exemple: "12" },
  { nom: "garantie_texte", obligatoire: false, format: "Neuf seulement : organes couverts", exemple: "Moteur et boîte" },
  { nom: "description", obligatoire: false, format: "Texte libre, requis pour publier", exemple: "Trail routier polyvalent, idéal Tana et RN7." },
  { nom: "points_forts", obligatoire: false, format: "Séparés par |", exemple: "ABS de série|Selle basse" },
  { nom: "fournisseur", obligatoire: false, format: "Nom du fournisseur, créé s'il n'existe pas. Interne", exemple: "Guangzhou Moto Co" },
];

/** Le modèle est écrit en points-virgules : Excel en français l'ouvre en colonnes. */
const SEP = ";";
const cellule = (v: string) => (/[";\n,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const ligneCsv = (valeurs: string[]) => valeurs.map(cellule).join(SEP);

/** Modèle vide : la ligne d'en-tête seule, à remplir. */
export const CSV_MODELE_VIDE = ligneCsv(COLONNES_CSV.map((c) => c.nom));

/** Modèle avec deux exemples, un neuf et une occasion, à remplacer par vos fiches. */
export const CSV_MODELE = [
  CSV_MODELE_VIDE,
  ligneCsv(COLONNES_CSV.map((c) => c.exemple)),
  ligneCsv(
    COLONNES_CSV.map((c) =>
      ({
        reference: "MI-102", marque: "Yamaha", modele: "MT-07", annee: "2021", cylindree: "689",
        categorie: "roadster", etat: "occasion", prix_yuan: "22000", prix_valable_jusqu_au: "31/12/2026",
        disponibilite: "local", kilometrage: "18400", date_photos: "10/09/2026", couleur: "Gris", puissance_ch: "73",
        poids_kg: "184", hauteur_selle_mm: "805", refroidissement: "liquide", transmission: "6 rapports",
        abs: "oui", garantie_mois: "", garantie_texte: "",
        description: "Roadster vif et léger, entretenu, pneus récents.", points_forts: "Moteur coupleux|Léger",
        fournisseur: "Guangzhou Moto Co",
      })[c.nom] ?? ""
    )
  ),
].join("\n");
