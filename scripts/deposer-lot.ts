/**
 * Dépose un CSV de lot en base, en rejouant la boucle de
 * `app/api/import/motos/route.ts` (mêmes fonctions, même ordre) sans la couche
 * HTTP ni le contrôle de session.
 *
 * Simulation par défaut : rien n'est écrit sans `--ecrire`. Une référence déjà
 * présente en base arrête tout, sauf `--mettre-a-jour` : une référence existante
 * déclenche une mise à jour de fiche, pas une création, et ça passerait inaperçu.
 *
 *   npx tsx scripts/deposer-lot.ts <chemin.csv>
 *   npx tsx scripts/deposer-lot.ts <chemin.csv> --ecrire
 */
import fs from "node:fs";
import path from "node:path";
import { db, supabaseConfigure } from "../lib/db";
import { analyserCsvMotos } from "../lib/import-csv";
import { REGLAGES_DEFAUT } from "../lib/tarification-defaut";
import { erreurReglages } from "../lib/tarification";
import { miseEnVenteDe } from "../lib/types";
import type { MotoInput } from "../lib/schemas";

const args = process.argv.slice(2);
const CHEMIN = args.find((a) => !a.startsWith("--"));
const ECRIRE = args.includes("--ecrire");
const MAJ = args.includes("--mettre-a-jour");
const LOCAL = args.includes("--local");

if (!CHEMIN) {
  console.error("Usage : npx tsx scripts/deposer-lot.ts <chemin.csv> [--ecrire] [--mettre-a-jour] [--local]");
  process.exit(1);
}

/**
 * Next lit `.env.local` tout seul ; un script lancé sous tsx, non. Sans cette
 * lecture, `supabaseConfigure()` est faux et `db()` bascule en silence sur le
 * magasin JSON local : le lot part dans la base de test sans que rien ne le dise.
 */
function chargerEnvLocal() {
  for (const fichier of [".env.local", ".env"]) {
    if (!fs.existsSync(fichier)) continue;
    for (const ligne of fs.readFileSync(fichier, "utf8").split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  }
}

async function main() {
  chargerEnvLocal();

  const surSupabase = supabaseConfigure();
  console.log(`Base      : ${surSupabase ? "Supabase" : "magasin local JSON (data/local-db.json)"}`);
  if (!surSupabase && ECRIRE && !LOCAL) {
    console.error(
      "\nREFUSÉ : écriture demandée alors que Supabase n'est pas configuré.\n" +
        "Le lot partirait dans la base de test. Vérifiez .env.local,\n" +
        "ou ajoutez --local si c'est bien la base locale que vous visez."
    );
    process.exit(1);
  }

  const pilote = db();

  // Réglages en vigueur, comme `reglagesEnVigueur()` (module server-only).
  const stockes = await pilote.lireTarification().catch(() => null);
  const fusion = stockes ? { ...REGLAGES_DEFAUT, ...stockes } : REGLAGES_DEFAUT;
  const reglages = erreurReglages(fusion) ? REGLAGES_DEFAUT : fusion;
  console.log(`Mode      : ${ECRIRE ? "ÉCRITURE" : "simulation (rien n'est écrit)"}`);
  console.log(`Fichier   : ${CHEMIN}`);
  console.log(`Réglages  : ${reglages.taux_yuan} Ar / ¥\n`);

  const analyse = analyserCsvMotos(fs.readFileSync(CHEMIN!, "utf8"), reglages);
  if (!analyse.ok) {
    console.error(`REFUSÉ : ${analyse.erreurs.length} erreur(s), rien écrit.`);
    for (const e of analyse.erreurs) console.error(` ligne ${e.ligne} · ${e.colonne} : ${e.message}`);
    process.exit(1);
  }
  console.log(`${analyse.motos.length} ligne(s) valide(s).\n`);

  // Garde-fou : une référence déjà prise est une mise à jour déguisée.
  const deja: string[] = [];
  for (const m of analyse.motos) {
    if (await pilote.motoParReference(m.reference)) deja.push(m.reference);
  }
  if (deja.length && !MAJ) {
    console.error(`REFUSÉ : ${deja.length} référence(s) déjà en base : ${deja.join(", ")}`);
    console.error("Ajoutez --mettre-a-jour si la mise à jour est voulue.");
    process.exit(1);
  }

  const cacheFournisseurs = new Map<string, string>();
  const resoudreFournisseur = async (nom?: string): Promise<string | null> => {
    if (!nom) return null;
    const cle = nom.toLowerCase();
    if (cacheFournisseurs.has(cle)) return cacheFournisseurs.get(cle)!;
    const existant = await pilote.fournisseurParNom(nom);
    if (!existant && !ECRIRE) {
      console.log(`  (fournisseur à créer : ${nom})`);
      cacheFournisseurs.set(cle, "");
      return null;
    }
    const f =
      existant ??
      (await pilote.creerFournisseur({ nom, contact: null, ville_chine: null, specialite: null, notes: null }));
    if (!existant) console.log(`  (fournisseur créé : ${nom})`);
    cacheFournisseurs.set(cle, f.id);
    return f.id;
  };

  const rapport: { reference: string; action: "cree" | "mis_a_jour" }[] = [];

  for (const { fournisseur, mise_en_vente_fournie, ...moto } of analyse.motos) {
    const fournisseur_id = await resoudreFournisseur(fournisseur);
    const existante = await pilote.motoParReference(moto.reference);

    if (!ECRIRE) {
      console.log(
        `simulerait  ${moto.reference}  ${moto.marque} ${moto.modele}  ` +
          `${moto.prix_ttc.toLocaleString("fr-FR")} Ar  [brouillon]`
      );
      rapport.push({ reference: moto.reference, action: existante ? "mis_a_jour" : "cree" });
      continue;
    }

    const miseEnVente =
      existante && (existante.statut !== "brouillon" || !mise_en_vente_fournie)
        ? miseEnVenteDe(existante)
        : moto.mise_en_vente;

    const donnees = {
      ...moto,
      prix_ttc: moto.prix_ttc,
      prix_yuan: moto.prix_yuan ?? null,
      taux_yuan: moto.taux_yuan ?? null,
      acompte_pct: moto.acompte_pct ?? null,
      statut: existante?.statut ?? "brouillon",
      mise_en_vente: miseEnVente,
      fournisseur_id,
    } as MotoInput;

    const { moto: enregistree, cree } = await pilote.enregistrerParReference(donnees);
    rapport.push({ reference: moto.reference, action: cree ? "cree" : "mis_a_jour" });
    console.log(
      `${cree ? "créée      " : "mise à jour"} ${enregistree.reference}  ${enregistree.marque} ${enregistree.modele}  ${enregistree.prix_ttc.toLocaleString("fr-FR")} Ar  [${enregistree.statut}]`
    );
  }

  if (!ECRIRE) {
    console.log(`\nSimulation : ${rapport.length} fiche(s) seraient créées. Rien n'a été écrit.`);
    console.log("Relancez avec --ecrire pour déposer.");
    return;
  }

  const lot = await pilote.creerLot({
    type: "motos_csv",
    fichier_nom: path.basename(CHEMIN!),
    total: analyse.total,
    reussis: rapport.length,
    echoues: 0,
    rapport: { lignes: rapport },
    auteur_id: null,
  });

  console.log(`\nLot ${lot.id}`);
  console.log(
    `${rapport.filter((r) => r.action === "cree").length} créées, ${rapport.filter((r) => r.action === "mis_a_jour").length} mises à jour.`
  );
}

main().catch((e) => {
  console.error("Interrompu :", e);
  process.exit(1);
});
