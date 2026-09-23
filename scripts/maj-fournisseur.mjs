/**
 * Renomme un fournisseur et renseigne son contact.
 * Usage : node scripts/maj-fournisseur.mjs <nom_actuel> <nouveau_nom> <contact> [ville]
 */
import { chargerEnvLocal } from "./env-local.mjs";

await chargerEnvLocal();

const [actuel, nouveau, contact, ville = "Chine"] = process.argv.slice(2);
if (!actuel || !nouveau || !contact) {
  console.error("Usage : node scripts/maj-fournisseur.mjs <nom_actuel> <nouveau_nom> <contact> [ville]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !cle) {
  console.error("Supabase non configure : rien fait.");
  process.exit(1);
}
const entetes = { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" };

const lire = async (nom) => {
  const r = await fetch(`${url}/rest/v1/fournisseurs?nom=eq.${encodeURIComponent(nom)}&select=*`, { headers: entetes });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
};

const [cible] = await lire(actuel);
if (!cible) {
  console.error(`Fournisseur "${actuel}" introuvable.`);
  process.exit(1);
}
if (actuel !== nouveau && (await lire(nouveau)).length) {
  console.error(`"${nouveau}" existe deja : fusion non automatique, rien fait.`);
  process.exit(1);
}

console.log(`avant : ${cible.nom}  contact=${cible.contact ?? "-"}  ville=${cible.ville_chine ?? "-"}`);

const r = await fetch(`${url}/rest/v1/fournisseurs?id=eq.${cible.id}`, {
  method: "PATCH",
  headers: { ...entetes, Prefer: "return=representation" },
  body: JSON.stringify({ nom: nouveau, contact, ville_chine: ville }),
});
if (!r.ok) {
  console.error(`Echec : ${r.status} ${await r.text()}`);
  process.exit(1);
}
const [apres] = await r.json();
console.log(`apres : ${apres.nom}  contact=${apres.contact}  ville=${apres.ville_chine}`);
console.log(`id inchange : ${apres.id} — les 15 fiches restent rattachees.`);
