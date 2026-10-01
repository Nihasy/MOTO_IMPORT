/**
 * Pose le volume de caisse (m3) sur les fiches dont le modele figure au releve
 * "Cubage motos en caisse" du 01/10/2026. Les autres fiches gardent le volume
 * standard de leur categorie (page Tarification).
 *
 * Usage : node scripts/volumes-catalogue.mjs            simulation, rien n'est ecrit
 *         node scripts/volumes-catalogue.mjs --ecrire   ecrit en base
 *
 * Prerequis : migration 0012 appliquee (colonne volume_m3).
 *
 * Le script n'ecrit que le volume. Les prix se recalculent ensuite depuis le
 * back-office : Tarification > Enregistrer, qui montre l'effet avant d'ecrire.
 * Une fiche qui porte deja un volume n'est pas touchee : il a pu etre mesure.
 */
import { chargerEnvLocal } from "./env-local.mjs";

await chargerEnvLocal();

const ECRIRE = process.argv.includes("--ecrire");

// Volume du releve pour le modele meme, sauf "proche" : modele absent du
// releve, volume d'un modele voisin de meme chassis ou de meme gabarit.
const VOLUMES = {
  "MI-001": [1.09, "BMW S1000RR"],
  "MI-002": [1.16, "proche : Ducati Panigale V4"],
  "MI-003": [1.15, "Kawasaki Z1000"],
  "MI-004": [1.16, "proche : Ducati Panigale V4"],
  "MI-005": [1.14, "Suzuki GSX-S1000"],
  "MI-006": [1.07, "Suzuki GSX-R1000"],
  "MI-007": [1.11, "Harley-Davidson Sportster Forty-Eight"],
  "MI-008": [1.03, "Yamaha MT-09 2017-2020"],
  "MI-009": [1.14, "Yamaha MT-10"],
  "MI-010": [1.08, "Yamaha YZF-R1"],
  "MI-013": [1.08, "Yamaha YZF-R1"],
  "MI-014": [1.3, "BMW R nineT"],
  "MI-015": [1.0, "Suzuki GSX-R600"],
  "MI-016": [1.08, "Yamaha YZF-R1"],
  "MI-017": [1.04, "Yamaha YZF-R6"],
  "MI-018": [1.15, "Kawasaki Z1000"],
  "MI-019": [1.03, "Kawasaki Ninja ZX-6R"],
  "MI-021": [1.17, "proche : KTM 890 Adventure"],
  "MI-024": [1.06, "Yamaha XSR900"],
  "MI-035": [1.13, "CFMOTO 800MT"],
  "MI-037": [1.04, "Honda CBR650R"],
  "MI-042": [1.03, "CFMOTO 800NK"],
  "MI-044": [1.06, "Yamaha XSR900"],
  "MI-046": [1.02, "Benelli 752S"],
  "MI-057": [1.15, "Kawasaki Z1000"],
  "MI-058": [1.2, "Kawasaki Z H2"],
  "MI-059": [1.08, "Kawasaki Z900"],
  "MI-060": [1.29, "proche : BMW F850GS"],
  "MI-061": [1.16, "proche : Ducati Panigale V4"],
  "MI-062": [1.29, "proche : Ducati Multistrada V4"],
  "MI-064": [1.29, "proche : Ducati Multistrada V4"],
  "MI-065": [1.53, "proche : mediane des grand tourisme"],
  "MI-066": [1.04, "Honda CBR650R"],
  "MI-067": [1.64, "Triumph Rocket 3"],
  "MI-068": [1.04, "Honda CBR650R"],
  "MI-069": [1.16, "Ducati Panigale V4"],
  "MI-071": [1.32, "proche : Ducati Diavel V4"],
  "MI-101": [1.42, "BMW R1200GS Adventure LC"],
  "MI-102": [1.42, "BMW R1200GS Adventure LC"],
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error("Supabase non configure : rien fait.");
  process.exit(1);
}
const entetes = { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" };
const refs = Object.keys(VOLUMES);

console.log(`base : ${new URL(url).host}`);
console.log(`mode : ${ECRIRE ? "ECRITURE" : "simulation (rien n'est ecrit)"}\n`);

const r = await fetch(
  `${url}/rest/v1/motos?reference=in.(${refs.join(",")})&select=reference,marque,modele,statut,volume_m3&order=reference`,
  { headers: entetes }
);
if (!r.ok) {
  const texte = await r.text();
  console.error(
    texte.includes("volume_m3")
      ? "La colonne volume_m3 n'existe pas : appliquez d'abord supabase/migrations/0012_volume_et_marge.sql."
      : `${r.status} ${texte}`
  );
  process.exit(1);
}
const motos = await r.json();

const absentes = refs.filter((ref) => !motos.some((m) => m.reference === ref));
if (absentes.length) console.log(`Introuvables, ignorees : ${absentes.join(", ")}\n`);

let ecrites = 0;
for (const m of motos) {
  const [volume, source] = VOLUMES[m.reference];
  const nom = `${m.reference}  ${m.marque} ${m.modele}`.padEnd(46);
  if (m.volume_m3 != null) {
    console.log(`garde     ${nom} ${m.volume_m3} m3 deja saisi`);
    continue;
  }
  if (ECRIRE) {
    const maj = await fetch(`${url}/rest/v1/motos?reference=eq.${m.reference}`, {
      method: "PATCH",
      headers: { ...entetes, Prefer: "return=minimal" },
      body: JSON.stringify({ volume_m3: volume }),
    });
    if (!maj.ok) {
      console.error(`ECHEC     ${nom} ${maj.status} ${await maj.text()}`);
      process.exit(1);
    }
    ecrites++;
  }
  console.log(`${ECRIRE ? "ecrit    " : "ecrirait "} ${nom} ${volume} m3  (${source})`);
}

if (ECRIRE) {
  const verif = await fetch(`${url}/rest/v1/motos?volume_m3=not.is.null&select=reference`, { headers: entetes });
  console.log(`\n${ecrites} volume(s) ecrit(s) ; ${(await verif.json()).length} fiche(s) portent un volume en base.`);
  console.log("Reste a recalculer les prix : back-office > Tarification > Enregistrer.");
} else {
  console.log("\nSimulation. Relancez avec --ecrire pour ecrire.");
}
