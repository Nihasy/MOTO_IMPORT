/**
 * Recettes jouées contre le magasin JSON local, jamais contre Supabase.
 *
 *   npm run recette              les trois recettes
 *   npm run recette -- e2e       une seule (e2e | securite | charge)
 *   npm run recette -- --vite    réutilise la construction précédente
 *   npm run recette -- --sans-semis   garde le magasin en l'état
 *
 * Les trois recettes écrivent pour de bon : la charge crée quarante demandes
 * par passage, la sécurité en pousse quatre-vingt-dix. Branchées sur Supabase
 * elles polluent le back-office, et `scripts/env-local.mjs` les en empêche
 * désormais. Reste à leur offrir une cible : c'est ce que fait ce lanceur.
 *
 * Il tient les deux bouts dans un seul arbre de processus — la construction,
 * le serveur et les recettes — parce que c'est la seule façon de garantir
 * qu'ils visent le même magasin. Un serveur lancé à part, branché sur
 * Supabase, aurait laissé les recettes écrire dans la vraie base en croyant
 * bien faire : le garde-fou ne voit que son propre environnement, pas celui
 * du serveur qu'il interroge.
 *
 * Les variables Supabase sont posées à la chaîne vide plutôt que retirées :
 * `@next/env` comme `chargerEnvLocal` ne recouvrent que ce qui est
 * `undefined`, si bien qu'une variable vide traverse `.env.local` intacte.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

/** Port distinct du 3000 du serveur de développement, souvent déjà occupé. */
const PORT = Number(process.env.PORT_RECETTE ?? 3100);
const DOSSIER = ".next-recette";
const SUITES = { e2e: "scripts/e2e.mjs", securite: "scripts/securite.mjs", charge: "scripts/charge.mjs" };

const args = process.argv.slice(2);
const vite = args.includes("--vite");
const sansSemis = args.includes("--sans-semis");
const demandees = args.filter((a) => !a.startsWith("--"));
const inconnues = demandees.filter((d) => !(d in SUITES));
if (inconnues.length) {
  console.error(`Recette inconnue : ${inconnues.join(", ")}. Attendu : ${Object.keys(SUITES).join(", ")}.`);
  process.exit(1);
}
const aJouer = demandees.length ? demandees : Object.keys(SUITES);

const ENV = {
  ...process.env,
  // Le magasin JSON local prend le relais dès que ces trois-là sont vides.
  NEXT_PUBLIC_SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  NEXT_DIST_DIR: DOSSIER,
  E2E_BASE: `http://localhost:${PORT}`,
};

const lancer = (commande, arguments_, options = {}) =>
  new Promise((resoudre) => {
    const enfant = spawn(commande, arguments_, {
      stdio: "inherit",
      env: ENV,
      shell: process.platform === "win32",
      ...options,
    });
    enfant.on("exit", (code) => resoudre(code ?? 1));
  });

/** Vrai si quelque chose répond déjà sur le port : un serveur y survit. */
const portOccupe = async () => {
  try {
    await fetch(`http://localhost:${PORT}/`, { redirect: "manual", signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
};

const attendreServeur = async () => {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/motos`, { redirect: "manual" });
      if (r.status < 500) return true;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

/*
 * Semis avant chaque passage. Les recettes ne sont pas sans trace : elles
 * vendent MI-001, archivent un lot, importent des fiches. Sans remise à
 * plat, la construction suivante prégénère la fiche de MI-001 *vendue*, et
 * la recette échoue en cherchant un bloc prix de commande qui n'a plus lieu
 * d'être — un échec qui ne dit rien du code, seulement du passage précédent.
 */
if (!sansSemis) {
  console.log("\n── Semis du magasin local ────────────────────────────────────────\n");
  const code = await lancer("node", ["scripts/seed.mjs"]);
  if (code !== 0) {
    console.error("\nLe semis a échoué : recettes non jouées.");
    process.exit(code);
  }
}

if (!vite || !existsSync(DOSSIER)) {
  console.log(`\n── Construction sur le magasin local (${DOSSIER}) ─────────────────\n`);
  const code = await lancer("npx", ["next", "build"]);
  if (code !== 0) {
    console.error("\nLa construction a échoué : recettes non jouées.");
    process.exit(code);
  }
}

/*
 * Le port doit être libre AVANT de démarrer. Sinon `next start` échoue en
 * silence, les recettes interrogent le serveur resté en place, et leurs
 * échecs racontent l'état du passage précédent : compteurs de limitation de
 * flot déjà pleins, magasin déjà muté. Le mirage coûte cher à démêler —
 * mieux vaut refuser de démarrer.
 */
if (await portOccupe()) {
  console.error(
    `\n  ✖  Le port ${PORT} est déjà pris. Un serveur de recette précédent y tourne` +
      `\n     sans doute encore. Fermez-le, ou choisissez un autre port :` +
      `\n       PORT_RECETTE=3101 npm run recette\n`
  );
  process.exit(1);
}

console.log(`\n── Serveur de recette sur le port ${PORT} ──────────────────────────\n`);
/*
 * Lancé sans enveloppe de shell, et par le binaire de Next plutôt que par
 * `npx` : `serveur.pid` est alors le processus qui tient le port, et non un
 * `cmd.exe` dont la mort laisserait Node vivant derrière lui.
 */
const serveur = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  stdio: "ignore",
  env: ENV,
});

const arreterServeur = () => {
  if (serveur.exitCode !== null || serveur.killed) return;
  serveur.kill();
};
process.on("SIGINT", () => {
  arreterServeur();
  process.exit(130);
});

if (!(await attendreServeur())) {
  console.error(`\nServeur injoignable sur le port ${PORT}.`);
  arreterServeur();
  process.exit(1);
}

const resultats = [];
for (const nom of aJouer) {
  console.log(`\n── ${nom} ──────────────────────────────────────────────────────\n`);
  resultats.push([nom, await lancer("node", [SUITES[nom]])]);
}

arreterServeur();

console.log("\n────────────────────────────────────────────────────────────");
for (const [nom, code] of resultats) console.log(`  ${code === 0 ? "OK   " : "ECHEC"} ${nom}`);
process.exit(resultats.some(([, code]) => code !== 0) ? 1 : 0);
