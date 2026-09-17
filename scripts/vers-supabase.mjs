/**
 * Reprise du magasin local JSON vers Supabase.
 *
 * Le magasin local (`data/local-db.json`) suffit en developpement mais ne part
 * pas en production : il est ignore par git, et le systeme de fichiers d'un
 * hebergeur sans etat est en lecture seule. Ce script transfere les lignes
 * telles quelles, en conservant les identifiants : les liaisons moto -> media
 * -> lot restent valides, et une seconde execution met a jour au lieu de
 * dupliquer.
 *
 *   node scripts/vers-supabase.mjs --essai
 *   node scripts/vers-supabase.mjs
 *   node scripts/vers-supabase.mjs --tables=fournisseurs,motos,medias,demandes
 *   node scripts/vers-supabase.mjs --sauf-references=MI-901,MI-903
 *
 * Les migrations `supabase/migrations/*.sql` doivent avoir ete appliquees dans
 * l'ordre AVANT ce transfert, sinon les colonnes et les enums manquent.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const drapeau = (nom) => args.some((a) => a === `--${nom}`);
const valeur = (nom, defaut) => {
  const trouve = args.find((a) => a.startsWith(`--${nom}=`));
  return trouve ? trouve.slice(nom.length + 3) : defaut;
};

const ESSAI = drapeau("essai");
const TABLES = valeur("tables", "fournisseurs,motos,medias").split(",").map((t) => t.trim()).filter(Boolean);
const EXCLUES = new Set(
  valeur("sauf-references", "").split(",").map((r) => r.trim().toUpperCase()).filter(Boolean)
);

/** Variables lues comme Next les lit : l'environnement reel prime sur .env.local. */
async function chargerEnv() {
  for (const fichier of [".env.local", ".env"]) {
    let brut;
    try {
      brut = await readFile(fichier, "utf8");
    } catch {
      continue;
    }
    for (const ligne of brut.split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  }
}
await chargerEnv();

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Clef de service : elle contourne les politiques RLS, indispensable pour
// ecrire des lignes qui appartiendront ensuite au back-office.
const CLEF = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !CLEF) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.\n" +
      "Renseignez-les dans .env.local (Supabase : Project Settings > API)."
  );
  process.exit(1);
}

const FICHIER = process.env.LOCAL_DB_PATH ?? path.join(process.cwd(), "data", "local-db.json");
const base = JSON.parse(await readFile(FICHIER, "utf8"));

const motosRetenues = base.motos.filter((m) => !EXCLUES.has(m.reference.toUpperCase()));
const idsRetenus = new Set(motosRetenues.map((m) => m.id));

// Ordre impose par les cles etrangeres : fournisseurs avant motos, lots avant
// medias, motos avant medias et demandes.
const ORDRE = ["fournisseurs", "import_lots", "motos", "medias", "demandes"];
const aTransferer = ORDRE.filter((t) => TABLES.includes(t));

/**
 * `lot_id` ne survit qu'aux lots effectivement transferes. Les lots du magasin
 * local sont pour l'essentiel des artefacts de recette et restent en arriere
 * par defaut ; garder leur identifiant sur un media ferait echouer tout le
 * paquet sur la cle etrangere. Vide, il ne coute que la possibilite d'annuler
 * un lot deja ancien.
 */
const lotsTransferes = new Set(
  aTransferer.includes("import_lots") ? base.import_lots.map((l) => l.id) : []
);

/** Les lignes filles suivent le sort de leur moto : sinon la cle etrangere casse. */
const CONTENU = {
  fournisseurs: base.fournisseurs,
  import_lots: base.import_lots,
  motos: motosRetenues,
  medias: base.medias
    .filter((x) => idsRetenus.has(x.moto_id))
    .map((x) => (x.lot_id && !lotsTransferes.has(x.lot_id) ? { ...x, lot_id: null } : x)),
  demandes: base.demandes.filter((d) => !d.moto_id || idsRetenus.has(d.moto_id)),
};

console.log(`Source : ${FICHIER}`);
console.log(`Cible  : ${URL_BASE}`);
if (EXCLUES.size) console.log(`Exclues : ${[...EXCLUES].join(", ")}`);
console.log("");

for (const table of aTransferer) {
  const lignes = CONTENU[table] ?? [];
  if (!lignes.length) {
    console.log(`${table.padEnd(13)} aucune ligne`);
    continue;
  }
  if (ESSAI) {
    console.log(`${table.padEnd(13)} ${String(lignes.length).padStart(4)} ligne(s) — essai, rien n'est ecrit`);
    continue;
  }

  // Par paquets : un seul corps de requete portant cent mille lignes serait
  // refuse, et les medias en data URL pesent lourd.
  const PAQUET = table === "medias" ? 20 : 100;
  let ecrites = 0;
  for (let i = 0; i < lignes.length; i += PAQUET) {
    const lot = lignes.slice(i, i + PAQUET);
    const rep = await fetch(`${URL_BASE}/rest/v1/${table}?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: CLEF,
        Authorization: `Bearer ${CLEF}`,
        "Content-Type": "application/json",
        // Met a jour la ligne existante au lieu d'echouer : le script est
        // rejouable sans creer de doublon.
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(lot),
    });
    if (!rep.ok) {
      const detail = await rep.text();
      console.error(`\n${table} : echec HTTP ${rep.status}\n${detail.slice(0, 600)}`);
      process.exit(1);
    }
    ecrites += lot.length;
    process.stdout.write(`\r${table.padEnd(13)} ${String(ecrites).padStart(4)} / ${lignes.length}`);
  }
  console.log(`\r${table.padEnd(13)} ${String(ecrites).padStart(4)} ligne(s) transferee(s)`);
}

if (ESSAI) {
  console.log("\nEssai termine. Relancez sans --essai pour ecrire.");
} else {
  console.log("\nTransfert termine.");
}
