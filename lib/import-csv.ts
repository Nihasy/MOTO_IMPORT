import { ligneCsvSchema, motoSchema, type MotoInput } from "./schemas";
import { parserCsv } from "./csv";
import { calculerPrix, type Reglages } from "./tarification";

export type ErreurLigne = { ligne: number; colonne: string; message: string; valeur?: string };

export type AnalyseCsv =
  | { ok: true; motos: (MotoInput & { fournisseur?: string })[]; total: number }
  | { ok: false; erreurs: ErreurLigne[]; total: number };

const bool = (v: string | undefined): boolean =>
  ["true", "1", "oui", "yes", "vrai", "x"].includes((v ?? "").trim().toLowerCase());

const nombreOuNull = (v: string | undefined): number | null => {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const texteOuNull = (v: string | undefined): string | null => {
  const s = (v ?? "").trim();
  return s ? s : null;
};

/**
 * Date au format ISO. Excel en français réécrit « 2026-12-31 » en
 * « 31/12/2026 » à l'enregistrement : les deux sont acceptés. Une valeur
 * méconnaissable passe telle quelle, et la validation la signale.
 */
function dateIso(v: string | undefined): string | undefined {
  const s = (v ?? "").trim();
  const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!fr) return v;
  const [, j, m, a] = fr;
  return `${a}-${m.padStart(2, "0")}-${j.padStart(2, "0")}`;
}

/** Champs de prix calculés depuis le prix d'achat ; tout à vide sans lui. */
function prixDepuisYuan(yuan: number | null, r: Reglages) {
  if (!yuan || yuan <= 0) return { prix_ttc: 0, prix_yuan: null, taux_yuan: null, acompte_pct: null };
  const c = calculerPrix(yuan, r);
  return { prix_ttc: c.prix_ar, prix_yuan: yuan, taux_yuan: r.taux_yuan, acompte_pct: c.acompte_pct };
}

/**
 * Valide integralement un CSV avant toute ecriture.
 * Une seule ligne invalide invalide le fichier entier (regle 7.4).
 */
export function analyserCsvMotos(texte: string, reglages: Reglages): AnalyseCsv {
  const { entetes, lignes } = parserCsv(texte);
  const erreurs: ErreurLigne[] = [];

  const obligatoires = [
    "reference", "marque", "modele", "annee", "cylindree", "categorie", "etat",
    "prix_yuan", "prix_valable_jusqu_au",
  ];
  const manquantes = obligatoires.filter((c) => !entetes.includes(c));
  if (manquantes.length) {
    return {
      ok: false,
      total: lignes.length,
      erreurs: manquantes.map((c) => ({ ligne: 1, colonne: c, message: "Colonne absente du fichier" })),
    };
  }
  if (!lignes.length) {
    return { ok: false, total: 0, erreurs: [{ ligne: 1, colonne: "-", message: "Fichier sans aucune ligne de donnees" }] };
  }

  const motos: (MotoInput & { fournisseur?: string })[] = [];
  const referencesVues = new Map<string, number>();

  lignes.forEach((brut, i) => {
    const numLigne = i + 2; // en-tete = ligne 1
    const base = ligneCsvSchema.safeParse({
      ...brut,
      prix_valable_jusqu_au: dateIso(brut.prix_valable_jusqu_au),
      date_photos: dateIso(brut.date_photos),
    });
    if (!base.success) {
      for (const issue of base.error.issues) {
        const colonne = String(issue.path[0] ?? "-");
        erreurs.push({ ligne: numLigne, colonne, message: issue.message, valeur: brut[colonne] });
      }
      return;
    }
    const v = base.data;

    const doublon = referencesVues.get(v.reference);
    if (doublon) {
      erreurs.push({
        ligne: numLigne,
        colonne: "reference",
        message: `Reference deja presente ligne ${doublon} du meme fichier`,
        valeur: v.reference,
      });
      return;
    }
    referencesVues.set(v.reference, numLigne);

    const candidat = {
      reference: v.reference,
      marque: v.marque,
      modele: v.modele,
      annee: v.annee,
      cylindree: v.cylindree,
      categorie: v.categorie,
      etat: v.etat,
      // Toute fiche importée naît en brouillon, quoi que dise le fichier : elle
      // passe en vente depuis le back-office, une fois ses photos en place.
      // Une fiche déjà existante garde son statut (voir la route d'import).
      statut: "brouillon" as MotoInput["statut"],
      kilometrage: nombreOuNull(v.kilometrage),
      couleur: texteOuNull(v.couleur),
      puissance_ch: nombreOuNull(v.puissance_ch),
      poids_kg: nombreOuNull(v.poids_kg),
      hauteur_selle_mm: nombreOuNull(v.hauteur_selle_mm),
      refroidissement: (texteOuNull(v.refroidissement) as "air" | "liquide" | null) ?? null,
      transmission: texteOuNull(v.transmission),
      abs: bool(v.abs),
      ...prixDepuisYuan(nombreOuNull(v.prix_yuan), reglages),
      prix_valable_jusqu_au: v.prix_valable_jusqu_au,
      garantie_mois: nombreOuNull(v.garantie_mois) ?? 0,
      garantie_texte: texteOuNull(v.garantie_texte),
      description: v.description ?? "",
      points_forts: (v.points_forts ?? "").split("|").map((s) => s.trim()).filter(Boolean),
      date_photos: texteOuNull(v.date_photos),
    };

    const complet = motoSchema.safeParse(candidat);
    if (!complet.success) {
      for (const issue of complet.error.issues) {
        const colonne = String(issue.path[0] ?? "-");
        erreurs.push({ ligne: numLigne, colonne, message: issue.message });
      }
      return;
    }
    motos.push({ ...complet.data, fournisseur: texteOuNull(v.fournisseur) ?? undefined });
  });

  if (erreurs.length) return { ok: false, erreurs, total: lignes.length };
  return { ok: true, motos, total: lignes.length };
}
