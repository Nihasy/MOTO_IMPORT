/**
 * Lecture seule : references de motos et fournisseurs deja en base.
 * Sert a attribuer les references d'un nouveau lot sans ecraser une fiche.
 */
import { chargerEnvLocal } from "./env-local.mjs";

await chargerEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !cle) {
  console.error("Supabase non configure");
  process.exit(1);
}

const get = async (table, params) => {
  const r = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: { apikey: cle, Authorization: `Bearer ${cle}` },
  });
  if (!r.ok) throw new Error(`${table} : ${r.status} ${await r.text()}`);
  return r.json();
};

const motos = await get("motos", "select=reference,marque,modele,statut&order=reference.asc&limit=1000");
console.log(`motos en base : ${motos.length}`);
console.log(motos.map((m) => m.reference).join(" "));

const num = (r) => Number(String(r).replace(/\D/g, ""));
const reelles = motos.map((m) => num(m.reference)).filter((n) => n < 900);
console.log(`\nderniere reference reelle : MI-${String(Math.max(0, ...reelles)).padStart(3, "0")}`);

const f = await get("fournisseurs", "select=id,nom,contact,ville_chine");
console.log(`\nfournisseurs : ${f.length}`);
for (const x of f) console.log(`  ${x.nom}  contact=${x.contact ?? "-"}  ville=${x.ville_chine ?? "-"}`);
