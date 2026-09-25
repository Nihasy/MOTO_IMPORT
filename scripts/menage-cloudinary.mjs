/**
 * Ménage des photos orphelines sur Cloudinary.
 *
 * Supprimer une photo ou annuler un lot n'efface que la ligne `medias` : le
 * fichier reste sur Cloudinary, payé et invisible. C'est ce qu'a laissé le
 * double envoi du 25/09/2026 (71 copies de MI-058 à MI-065). Ce script liste
 * tout ce qui vit sous `moto-import/`, le compare aux `cloudinary_id` en base,
 * et ne propose que ce que plus aucune ligne ne référence.
 *
 *   node scripts/menage-cloudinary.mjs                 # simulation
 *   node scripts/menage-cloudinary.mjs --supprimer     # suppression
 *   node scripts/menage-cloudinary.mjs --prefixe moto-import/MI-058
 *
 * Un fichier de moins de 2 h est épargné : l'import en masse téléverse vers
 * Cloudinary avant d'écrire en base, et un envoi en cours a exactement l'air
 * d'un orphelin pendant quelques minutes.
 */
import { chargerEnvLocal } from "./env-local.mjs";

await chargerEnvLocal();

const args = process.argv.slice(2);
const SUPPRIMER = args.includes("--supprimer");
const iPrefixe = args.indexOf("--prefixe");
const PREFIXE = iPrefixe >= 0 ? args[iPrefixe + 1] : "moto-import/";
const AGE_MIN_MS = 2 * 3600 * 1000;

const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaCle = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const cle = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;

// Sans la base, tout paraîtrait orphelin : refuser plutôt que tout proposer.
if (!supaUrl || !supaCle) {
  console.error("Supabase non configuré : impossible de savoir ce qui est utilisé.");
  process.exit(1);
}
if (!cloud || !cle || !secret) {
  console.error("Cloudinary non configuré (cloud, clé ou secret manquant).");
  process.exit(1);
}
if (!PREFIXE.startsWith("moto-import/")) {
  // Le filigrane et les visuels du site vivent ailleurs : ne jamais y toucher.
  console.error(`Préfixe refusé : ${PREFIXE} (seul moto-import/ est concerné).`);
  process.exit(1);
}

console.log(`Base      : Supabase ${new URL(supaUrl).host}`);
console.log(`Cloud     : ${cloud}`);
console.log(`Préfixe   : ${PREFIXE}`);
console.log(`Mode      : ${SUPPRIMER ? "SUPPRESSION" : "simulation (rien n'est supprimé)"}\n`);

const auth = "Basic " + Buffer.from(`${cle}:${secret}`).toString("base64");
const api = `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload`;

async function utilises() {
  const ids = new Set();
  for (let depart = 0; ; depart += 1000) {
    const r = await fetch(`${supaUrl}/rest/v1/medias?select=cloudinary_id&order=id.asc`, {
      headers: { apikey: supaCle, Authorization: `Bearer ${supaCle}`, Range: `${depart}-${depart + 999}` },
    });
    if (!r.ok) throw new Error(`medias : ${r.status} ${await r.text()}`);
    const page = await r.json();
    for (const m of page) ids.add(m.cloudinary_id);
    if (page.length < 1000) return ids;
  }
}

async function stockes() {
  const tous = [];
  let curseur;
  do {
    const q = new URLSearchParams({ prefix: PREFIXE, max_results: "500" });
    if (curseur) q.set("next_cursor", curseur);
    const r = await fetch(`${api}?${q}`, { headers: { Authorization: auth } });
    if (!r.ok) throw new Error(`Cloudinary : ${r.status} ${await r.text()}`);
    const j = await r.json();
    tous.push(...j.resources);
    curseur = j.next_cursor;
  } while (curseur);
  return tous;
}

const [enBase, surCloud] = await Promise.all([utilises(), stockes()]);
if (enBase.size === 0) {
  console.error("Aucun média en base : refus, tout serait jugé orphelin.");
  process.exit(1);
}

// Seules les photos rangées dans un dossier de moto (`moto-import/MI-058/…`)
// peuvent être orphelines. Le reste de `moto-import/` sert au site sans figurer
// en base : le 25/09/2026, la première version de ce script a pris le
// filigrane (`moto-import/filigrane`, désigné par une variable
// d'environnement) pour un fichier de test et l'a effacé. Toute photo non
// encore en cache chez Cloudinary a alors renvoyé une erreur 400 sur le site.
const PROTEGES = new Set([process.env.NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID].filter(Boolean));
const dansUnDossierDeMoto = (id) => /^moto-import\/MI-\d+\/[^/]+$/i.test(id);

const maintenant = Date.now();
const horsPerimetre = surCloud.filter((r) => !enBase.has(r.public_id) && (PROTEGES.has(r.public_id) || !dansUnDossierDeMoto(r.public_id)));
const orphelins = surCloud.filter(
  (r) => !enBase.has(r.public_id) && !PROTEGES.has(r.public_id) && dansUnDossierDeMoto(r.public_id)
);
const recents = orphelins.filter((r) => maintenant - Date.parse(r.created_at) < AGE_MIN_MS);
const aSupprimer = orphelins.filter((r) => !recents.includes(r));

const parDossier = {};
for (const r of aSupprimer) {
  const d = r.public_id.split("/").slice(0, -1).join("/");
  parDossier[d] = (parDossier[d] ?? 0) + 1;
}
const octets = aSupprimer.reduce((s, r) => s + (r.bytes ?? 0), 0);

console.log(`Sur Cloudinary : ${surCloud.length}  ·  référencés en base : ${surCloud.filter((r) => enBase.has(r.public_id)).length}`);
console.log(`Orphelins      : ${orphelins.length}  (dont ${recents.length} de moins de 2 h, épargnés)`);
if (horsPerimetre.length) {
  console.log(`Jamais touchés : ${horsPerimetre.map((r) => r.public_id).join(", ")}`);
}
for (const [d, n] of Object.entries(parDossier).sort()) console.log(`  ${d} : ${n}`);
console.log(`À supprimer    : ${aSupprimer.length}  ·  ${(octets / 1024 / 1024).toFixed(1)} Mo\n`);

if (!SUPPRIMER || !aSupprimer.length) {
  if (aSupprimer.length) console.log("Relancez avec --supprimer pour les effacer.");
  process.exit(0);
}

// L'API accepte 100 identifiants par appel.
let faits = 0;
for (let i = 0; i < aSupprimer.length; i += 100) {
  const q = new URLSearchParams();
  for (const r of aSupprimer.slice(i, i + 100)) q.append("public_ids[]", r.public_id);
  const r = await fetch(`${api}?${q}`, { method: "DELETE", headers: { Authorization: auth } });
  if (!r.ok) throw new Error(`Suppression : ${r.status} ${await r.text()}`);
  const j = await r.json();
  faits += Object.values(j.deleted ?? {}).filter((v) => v === "deleted").length;
}
console.log(`Supprimés : ${faits} / ${aSupprimer.length}`);
