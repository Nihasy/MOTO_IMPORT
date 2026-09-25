/**
 * Redépose `public/filigrane.png` sur Cloudinary sous NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID.
 *
 * Toutes les URL filigranées citent ce public id dans leur couche
 * (`l_moto-import:filigrane`). S'il manque, Cloudinary ne dégrade pas : il
 * répond 400 et la photo disparaît. Seules survivent les dérivées déjà en
 * cache, ce qui rend la panne partielle et trompeuse — cartes du catalogue
 * intactes, grandes images des fiches vides.
 *
 *   node scripts/remettre-filigrane.mjs     # depuis la racine du dépôt
 */
import { readFile } from "node:fs/promises";
import crypto from "node:crypto";
import { chargerEnvLocal } from "./env-local.mjs";

await chargerEnvLocal();

const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const cle = process.env.CLOUDINARY_API_KEY;
const secret = process.env.CLOUDINARY_API_SECRET;
const id = process.env.NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID;
if (!cloud || !cle || !secret || !id) {
  console.error("Cloudinary non configuré (cloud, clé, secret ou identifiant du filigrane manquant).");
  process.exit(1);
}
console.log(`Cloud : ${cloud}  ·  public id : ${id}`);

const params = { overwrite: "true", public_id: id, timestamp: String(Math.floor(Date.now() / 1000)) };
const chaine = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
const signature = crypto.createHash("sha1").update(chaine + secret).digest("hex");

const fd = new FormData();
fd.append("file", new Blob([await readFile("public/filigrane.png")], { type: "image/png" }), "filigrane.png");
for (const [k, v] of Object.entries(params)) fd.append(k, v);
fd.append("api_key", cle);
fd.append("signature", signature);

const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: fd });
const j = await r.json();
if (!r.ok) {
  console.error(`Échec ${r.status} : ${j.error?.message}`);
  process.exit(1);
}
console.log(`Déposé : ${j.public_id} (${j.width}x${j.height} ${j.format})`);

const v = await fetch(`https://res.cloudinary.com/${cloud}/image/upload/${id}`, { method: "HEAD" });
console.log(`Livraison : ${v.status} ${v.headers.get("x-cld-error") ?? ""}`);
