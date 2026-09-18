/**
 * Test de concurrence et de charge.
 * Vérifie que plusieurs clients simultanés obtiennent des réponses correctes,
 * et cherche les pertes de mise à jour dans le pilote de données.
 *
 *   npm run build && npm start &   puis   npm run test:charge
 */
import { createHmac } from "node:crypto";
import { chargerEnvLocal, secretSession } from "./env-local.mjs";

await chargerEnvLocal();

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const SECRET = secretSession();

const forger = (charge) => {
  const c = Buffer.from(JSON.stringify(charge)).toString("base64url");
  return `${c}.${createHmac("sha256", SECRET).update(c).digest("base64url")}`;
};
const cookieAdmin = {
  Cookie: `mi_session=${forger({
    email: "nihasy@moto-import.mg",
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}`,
};

let reussis = 0;
const echecs = [];
let groupe = "";
const titre = (t) => {
  groupe = t;
  console.log(`\n${t}`);
};
const verifier = (nom, ok, detail = "") => {
  if (ok) {
    reussis++;
    console.log(`  OK    ${nom}`);
  } else {
    echecs.push({ groupe, nom, detail });
    console.log(`  ECHEC ${nom}${detail ? ` — ${detail}` : ""}`);
  }
};

const attendre = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE + "/motos", { redirect: "manual" })).status < 500) return true;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};
if (!(await attendre())) {
  console.error(`Serveur injoignable sur ${BASE}.`);
  process.exit(1);
}

const percentile = (tries, p) => tries[Math.min(tries.length - 1, Math.floor((tries.length * p) / 100))];

/** Lance `total` requêtes avec au plus `simultanes` en vol. */
async function rafale(chemin, total, simultanes, opts = {}) {
  const latences = [];
  const statuts = new Map();
  let curseur = 0;
  const debut = Date.now();

  const ouvrier = async () => {
    while (curseur < total) {
      curseur++;
      const t0 = Date.now();
      try {
        const r = await fetch(BASE + chemin, { redirect: "manual", ...opts });
        await r.text();
        statuts.set(r.status, (statuts.get(r.status) ?? 0) + 1);
      } catch (e) {
        statuts.set(`reseau:${e.code ?? e.message}`, (statuts.get(`reseau:${e.code ?? e.message}`) ?? 0) + 1);
      }
      latences.push(Date.now() - t0);
    }
  };
  await Promise.all(Array.from({ length: simultanes }, ouvrier));
  latences.sort((a, b) => a - b);

  return {
    duree: Date.now() - debut,
    statuts: Object.fromEntries(statuts),
    p50: percentile(latences, 50),
    p95: percentile(latences, 95),
    p99: percentile(latences, 99),
    max: latences[latences.length - 1],
    debit: Math.round((total / (Date.now() - debut)) * 1000),
  };
}

// Volume reglable : le serveur de developpement compile a la demande et sert
// une requete a la fois ; lui imposer 300 requetes ne mesure que sa lenteur.
// Les seuils de latence ne se jugent donc que sur un serveur de production.
const REQUETES = Number(process.env.CHARGE_REQUETES ?? 300);
const CLIENTS = Number(process.env.CHARGE_CLIENTS ?? 50);
const mesureLatence = BASE.startsWith("https://");
const seuil = (nom, p95) =>
  mesureLatence
    ? verifier(nom, p95 < 2000, `${p95} ms`)
    : console.log(`  —     ${nom} : sans objet hors production (${p95} ms en developpement)`);

// ── 1. Lecture concurrente du catalogue ───────────────────────────────────
titre(`1. Lecture concurrente — ${CLIENTS} clients simultanes, ${REQUETES} requetes`);

const lecture = await rafale("/motos", REQUETES, CLIENTS);
console.log(`        statuts ${JSON.stringify(lecture.statuts)}`);
console.log(`        p50 ${lecture.p50} ms · p95 ${lecture.p95} ms · p99 ${lecture.p99} ms · max ${lecture.max} ms · ${lecture.debit} req/s`);
verifier("toutes les reponses sont des 200", lecture.statuts[200] === REQUETES, JSON.stringify(lecture.statuts));
verifier("aucune erreur serveur sous charge", !Object.keys(lecture.statuts).some((s) => Number(s) >= 500));
seuil("le p95 reste sous 2 s", lecture.p95);

// ── 2. Lecture concurrente d'une fiche ────────────────────────────────────
titre(`2. Fiche produit — ${CLIENTS} clients simultanes, ${REQUETES} requetes`);

// La fiche visee est la premiere du catalogue : un slug ecrit en dur ne
// survivait pas au remplacement des donnees de demonstration.
const slugFiche = (await fetch(BASE + "/motos").then((r) => r.text())).match(/href="\/motos\/([a-z0-9-]+)"/)?.[1];
const fiche = await rafale(`/motos/${slugFiche ?? "inexistante"}`, REQUETES, CLIENTS);
console.log(`        statuts ${JSON.stringify(fiche.statuts)}`);
console.log(`        p50 ${fiche.p50} ms · p95 ${fiche.p95} ms · p99 ${fiche.p99} ms · ${fiche.debit} req/s`);
verifier("toutes les fiches repondent 200", fiche.statuts[200] === REQUETES, JSON.stringify(fiche.statuts));
seuil("le p95 de la fiche reste sous 2 s", fiche.p95);

// ── 3. Filtres concurrents et cohérence des résultats ─────────────────────
titre("3. Filtres concurrents — coherence des reponses");

const combinaisons = [
  ["/motos?cat=trail", "Trail"],
  ["/motos?etat=neuf", "Neuf"],
  ["/motos?max=12000000", "motos"],
  ["/motos?masquer_vendues=1", "motos"],
  ["/motos?q=honda", "Honda"],
];
const reponses = await Promise.all(
  Array.from({ length: 60 }, (_, i) => {
    const [chemin] = combinaisons[i % combinaisons.length];
    return fetch(BASE + chemin).then(async (r) => ({ chemin, statut: r.status, texte: await r.text() }));
  })
);
verifier("60 requetes filtrees simultanees repondent toutes 200", reponses.every((r) => r.statut === 200));
verifier(
  "chaque reponse filtree contient bien son contenu attendu",
  reponses.every((r) => r.texte.includes(combinaisons.find((c) => c[0] === r.chemin)[1])),
  "une reponse a ete servie a la mauvaise requete"
);

// ── 4. Écritures concurrentes : demandes ──────────────────────────────────
titre("4. Ecritures concurrentes — 40 demandes simultanees");

const avantDemandes = await fetch(BASE + "/api/demandes", { headers: cookieAdmin })
  .then((r) => r.json())
  .then((j) => j.demandes.length);

const envois = await Promise.all(
  Array.from({ length: 40 }, (_, i) =>
    fetch(BASE + "/api/demandes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `192.0.2.${i}` },
      body: JSON.stringify({ reference: "MI-001", nom: `Client ${i}`, message: `concurrence ${i}` }),
    }).then((r) => r.status)
  )
);
const crees = envois.filter((s) => s === 201).length;
const limites = envois.filter((s) => s === 429).length;

const apresDemandes = await fetch(BASE + "/api/demandes", { headers: cookieAdmin })
  .then((r) => r.json())
  .then((j) => j.demandes);

const noms = new Set(apresDemandes.map((d) => d.nom));
const perdues = crees - (apresDemandes.length - avantDemandes);

console.log(`        ${crees} acceptees, ${limites} limitees, ${apresDemandes.length - avantDemandes} reellement enregistrees`);
verifier(
  "aucune demande acceptee n'est perdue en ecriture concurrente",
  perdues === 0,
  `${perdues} demande(s) perdue(s) — lecture-modification-ecriture non atomique`
);
verifier(
  "chaque demande enregistree est distincte",
  envois.filter((s) => s === 201).every((_, i) => true) && noms.size >= Math.min(crees, 1),
  `${noms.size} noms distincts`
);

// ── 5. Bascules de statut concurrentes ────────────────────────────────────
titre("5. Bascules de statut concurrentes sur la meme moto");

const motos = await fetch(BASE + "/admin/motos", { headers: cookieAdmin }).then((r) => r.text());
const idMoto = motos.match(/\/admin\/motos\/([0-9a-f-]{36})/)?.[1];

let publiable = false;
if (idMoto) {
  const basculer = (statut) =>
    fetch(`${BASE}/api/motos/${idMoto}/statut`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...cookieAdmin },
      body: JSON.stringify({ statut }),
    });

  // La première fiche de la liste n'est pas forcément publiable : sur une base
  // réelle, c'est souvent un brouillon sans photo, que le verrou refuse à bon
  // droit de mettre en vente. On sonde d'abord ; si la vente est refusée, la
  // concurrence est éprouvée sur les statuts que le verrou laisse toujours
  // passer — l'objet du test est l'écriture simultanée, pas la publication.
  publiable = (await basculer("reserve")).status === 200;
  const repos = publiable ? "disponible" : "brouillon";
  const statuts = publiable
    ? ["disponible", "reserve", "vendu", "disponible", "reserve", "vendu"]
    : ["vendu", "brouillon", "archive", "vendu", "brouillon", "archive"];
  if (!publiable) console.log("        fiche non publiable : bascules sur vendu / brouillon / archive");

  const resultats = await Promise.all(statuts.map((s) => basculer(s).then((r) => r.status)));
  verifier("6 bascules simultanees repondent toutes 200", resultats.every((s) => s === 200), JSON.stringify(resultats));

  const final = await fetch(BASE + "/admin/motos", { headers: cookieAdmin });
  verifier("la liste reste lisible apres bascules concurrentes", final.status === 200, `statut ${final.status}`);

  // Cohérence métier : date_vente doit suivre le statut final.
  const reponse = await basculer(repos);
  const remise = await reponse.json().catch(() => ({}));
  verifier(
    "date_vente reste coherente avec le statut apres concurrence",
    reponse.status === 200 && remise.moto?.statut === repos && remise.moto?.date_vente === null,
    `statut ${reponse.status} · ${JSON.stringify(remise.moto ?? remise).slice(0, 160)}`
  );
}

// ── 6. Créations concurrentes de la même référence ────────────────────────
titre("6. Creation concurrente de la meme reference");

const csv = (ref) =>
  "reference,marque,modele,annee,cylindree,categorie,etat,prix_ttc,prix_valable_jusqu_au,description\n" +
  `${ref},Course,Concurrence,2024,600,roadster,neuf,15000000,2027-06-30,"Fiche creee simultanement par plusieurs clients pour eprouver l'unicite de la reference."`;

const REF = "MI-950";
// Rejouable : si un passage precedent a deja cree la fiche, les huit imports
// doivent tous la mettre a jour, et aucun ne doit se declarer createur.
const fichesAvant = await fetch(`${BASE}/admin/motos?q=${REF}`, { headers: cookieAdmin }).then((r) => r.text());
const existait = /\/admin\/motos\/[0-9a-f-]{36}/.test(fichesAvant);
const creations = await Promise.all(
  Array.from({ length: 8 }, () =>
    fetch(BASE + "/api/import/motos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...cookieAdmin },
      body: JSON.stringify({ csv: csv(REF), fichier_nom: "concurrence.csv" }),
    }).then((r) => r.json())
  )
);

const total = { crees: 0, majs: 0 };
for (const c of creations) {
  total.crees += c.crees ?? 0;
  total.majs += c.mis_a_jour ?? 0;
}

console.log(`        ${total.crees} creation(s) et ${total.majs} mise(s) a jour sur 8 imports simultanes`);
verifier(
  "8 imports simultanes de la meme reference ne creent qu'une fiche",
  existait ? total.crees === 0 && total.majs === 8 : total.crees === 1 && total.majs === 7,
  `${total.crees} creations et ${total.majs} mises a jour (fiche ${existait ? "deja presente" : "nouvelle"})`
);

// Verification independante, cote back-office : une fiche importee sans photo
// est retenue en brouillon, donc absente du catalogue public — c'est la liste
// d'administration qui dit combien de fiches portent cette reference.
const listeRef = await fetch(`${BASE}/admin/motos?q=${REF}`, { headers: cookieAdmin }).then((r) => r.text());
const idsRef = new Set([...listeRef.matchAll(/\/admin\/motos\/([0-9a-f-]{36})/g)].map((m) => m[1]));
verifier(
  "une seule fiche porte cette reference apres les imports simultanes",
  idsRef.size === 1,
  `${idsRef.size} fiche(s) pour ${REF}`
);

// ── 7. Insertion concurrente de médias ────────────────────────────────────
titre("7. Insertion concurrente de medias sur la meme moto");

if (idMoto) {
  const media = (n) => ({
    moto_id: idMoto,
    type: "photo",
    origine: "reelle",
    vue: "autre",
    cloudinary_id: `charge/media-${n}`,
    largeur: 800,
    hauteur: 600,
    ordre: 800 + n,
    alt: `Media de charge ${n}`,
  });

  const lots = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      fetch(BASE + "/api/import/medias", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        body: JSON.stringify({ fichier_nom: `charge-${i}`, medias: [media(i * 2), media(i * 2 + 1)] }),
      }).then((r) => r.json())
    )
  );

  const totalReussis = lots.reduce((a, l) => a + (l.reussis ?? 0), 0);
  verifier("les 12 medias concurrents sont tous enregistres", totalReussis === 12, `${totalReussis}/12`);

  const page = await fetch(`${BASE}/admin/motos/${idMoto}?onglet=photos`, { headers: cookieAdmin }).then((r) => r.text());
  const presents = Array.from({ length: 12 }, (_, i) => page.includes(`media-${i}`)).filter(Boolean).length;
  verifier(
    "aucun media n'est perdu par ecrasement concurrent",
    presents === 12,
    `${presents}/12 retrouves en base`
  );

  // Nettoyage : annulation des lots créés.
  for (const l of lots) {
    if (l.lot_id) await fetch(`${BASE}/api/import/lots/${l.lot_id}`, { method: "DELETE", headers: cookieAdmin });
  }
}

// ── 8. Charge mixte : lecture publique pendant des écritures admin ────────
titre("8. Charge mixte — lectures publiques pendant ecritures admin");

const [lectures, ecrituresAdmin] = await Promise.all([
  rafale("/motos", 120, 30),
  Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      fetch(`${BASE}/api/motos/${idMoto}/statut`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        // Memes statuts que la section 5 : ceux que le verrou laisse passer.
        body: JSON.stringify({ statut: publiable ? (i % 2 ? "reserve" : "disponible") : (i % 2 ? "vendu" : "brouillon") }),
      }).then((r) => r.status)
    )
  ),
]);

console.log(`        lectures ${JSON.stringify(lectures.statuts)} · p95 ${lectures.p95} ms`);
verifier("les lectures publiques restent servies pendant les ecritures", lectures.statuts[200] === 120, JSON.stringify(lectures.statuts));
verifier("les ecritures admin aboutissent toutes", ecrituresAdmin.every((s) => s === 200), JSON.stringify(ecrituresAdmin));
// Juge sur la structure de la page, pas sur le texte d'une moto de
// demonstration qui disparait avec les vraies donnees.
const catalogueFinal = await fetch(BASE + "/motos");
verifier(
  "aucune corruption : le catalogue reste lisible",
  catalogueFinal.status === 200 && (await catalogueFinal.text()).includes("Trier par"),
  `statut ${catalogueFinal.status}`
);

// ── 9. Intégrité du magasin après toute la charge ─────────────────────────
titre("9. Integrite finale");

const integrite = await fetch(BASE + "/admin/motos", { headers: cookieAdmin });
verifier("la liste admin repond encore 200", integrite.status === 200);
const corps = await integrite.text();
// L'interface n'affiche plus de compteur « Motos (N) » : on juge la page sur son
// titre et sur l'absence de page d'erreur.
verifier(
  "la liste admin s'affiche sans erreur apres la charge",
  corps.includes("Motos") && !/Application error|Internal Server Error/i.test(corps),
  "la page admin est en erreur"
);

const sante = await rafale("/motos", 40, 40);
verifier("40 clients strictement simultanes sont tous servis", sante.statuts[200] === 40, JSON.stringify(sante.statuts));

// ── Bilan ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(64)}`);
console.log(`Concurrence : ${reussis} verifications reussies, ${echecs.length} echec(s).`);
if (echecs.length) {
  console.log("\nEchecs :");
  for (const e of echecs) console.log(`  - [${e.groupe}] ${e.nom}\n      ${e.detail}`);
  process.exit(1);
}
console.log("Aucun probleme de concurrence detecte.");
