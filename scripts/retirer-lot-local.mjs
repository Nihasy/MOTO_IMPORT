/**
 * Retire du magasin local les fiches deposees par erreur, apres sauvegarde.
 * Usage : node scripts/retirer-lot-local.mjs MI-021 MI-022 ...
 */
import { readFile, writeFile, copyFile } from "node:fs/promises";

const refs = new Set(process.argv.slice(2).filter((a) => /^MI-\d+$/.test(a)));
const FOURNISSEUR = "MOTO_YANGMIE";
const CHEMIN = "data/local-db.json";

if (!refs.size) {
  console.error("Aucune reference donnee, rien fait.");
  process.exit(1);
}

const sauvegarde = `${CHEMIN}.avant-retrait-${Date.now()}.bak`;
await copyFile(CHEMIN, sauvegarde);
console.log(`Sauvegarde : ${sauvegarde}`);

const base = JSON.parse(await readFile(CHEMIN, "utf8"));

const aRetirer = base.motos.filter((m) => refs.has(m.reference));
const ids = new Set(aRetirer.map((m) => m.id));
console.log(`motos visees : ${aRetirer.length} / ${refs.size} demandees`);

base.motos = base.motos.filter((m) => !refs.has(m.reference));
const mediasAvant = base.medias?.length ?? 0;
if (base.medias) base.medias = base.medias.filter((x) => !ids.has(x.moto_id));

const f = base.fournisseurs?.find((x) => x.nom === FOURNISSEUR);
const encoreUtilise = f && base.motos.some((m) => m.fournisseur_id === f.id);
if (f && !encoreUtilise) {
  base.fournisseurs = base.fournisseurs.filter((x) => x.id !== f.id);
  console.log(`fournisseur retire : ${FOURNISSEUR}`);
}

const lotsAvant = base.import_lots?.length ?? 0;
if (base.import_lots) {
  base.import_lots = base.import_lots.filter((l) => l.fichier_nom !== "motos-2026-09-21.csv");
}

await writeFile(CHEMIN, JSON.stringify(base, null, 2), "utf8");
console.log(`motos : ${base.motos.length}  medias : ${base.medias?.length ?? 0} (etait ${mediasAvant})  lots : ${base.import_lots?.length ?? 0} (etait ${lotsAvant})`);
console.log("references restantes :", base.motos.map((m) => m.reference).sort().join(" "));
