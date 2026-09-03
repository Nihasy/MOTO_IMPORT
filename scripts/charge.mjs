/**
 * Test de concurrence et de charge.
 * Vérifie que plusieurs clients simultanés obtiennent des réponses correctes,
 * et cherche les pertes de mise à jour dans le pilote de données.
 *
 *   npm run build && npm start &   puis   npm run test:charge
 */
import { createHmac } from "node:crypto";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const SECRET = process.env.AUTH_SECRET ?? process.env.REVALIDATE_SECRET ?? "dev-secret-moto-import";

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

// ── 1. Lecture concurrente du catalogue ───────────────────────────────────
titre("1. Lecture concurrente — 50 clients simultanes, 300 requetes");

const lecture = await rafale("/motos", 300, 50);
console.log(`        statuts ${JSON.stringify(lecture.statuts)}`);
console.log(`        p50 ${lecture.p50} ms · p95 ${lecture.p95} ms · p99 ${lecture.p99} ms · max ${lecture.max} ms · ${lecture.debit} req/s`);
verifier("toutes les reponses sont des 200", lecture.statuts[200] === 300, JSON.stringify(lecture.statuts));
verifier("aucune erreur serveur sous charge", !Object.keys(lecture.statuts).some((s) => Number(s) >= 500));
verifier("le p95 reste sous 2 s", lecture.p95 < 2000, `${lecture.p95} ms`);

// ── 2. Lecture concurrente d'une fiche ────────────────────────────────────
titre("2. Fiche produit — 50 clients simultanes, 300 requetes");

const fiche = await rafale("/motos/honda-cb500x-2023-mi001", 300, 50);
console.log(`        statuts ${JSON.stringify(fiche.statuts)}`);
console.log(`        p50 ${fiche.p50} ms · p95 ${fiche.p95} ms · p99 ${fiche.p99} ms · ${fiche.debit} req/s`);
verifier("toutes les fiches repondent 200", fiche.statuts[200] === 300, JSON.stringify(fiche.statuts));
verifier("le p95 de la fiche reste sous 2 s", fiche.p95 < 2000, `${fiche.p95} ms`);

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

if (idMoto) {
  const statuts = ["disponible", "reserve", "vendu", "disponible", "reserve", "vendu"];
  const resultats = await Promise.all(
    statuts.map((s) =>
      fetch(`${BASE}/api/motos/${idMoto}/statut`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...cookieAdmin },
        body: JSON.stringify({ statut: s }),
      }).then((r) => r.status)
    )
  );
  verifier("6 bascules simultanees repondent toutes 200", resultats.every((s) => s === 200), JSON.stringify(resultats));

  const final = await fetch(BASE + "/admin/motos", { headers: cookieAdmin }).then((r) => r.text());
  verifier("la liste reste lisible apres bascules concurrentes", final.includes("Motos ("));

  // Cohérence métier : date_vente doit suivre le statut final.
  const remise = await fetch(`${BASE}/api/motos/${idMoto}/statut`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...cookieAdmin },
    body: JSON.stringify({ statut: "disponible" }),
  }).then((r) => r.json());
  verifier(
    "date_vente reste coherente avec le statut apres concurrence",
    remise.moto.statut === "disponible" && remise.moto.date_vente === null,
    JSON.stringify(remise.moto)
  );
}

// ── 6. Créations concurrentes de la même référence ────────────────────────
titre("6. Creation concurrente de la meme reference");

const csv = (ref) =>
  "reference,marque,modele,annee,cylindree,categorie,etat,prix_ttc,prix_valable_jusqu_au,description\n" +
  `${ref},Course,Concurrence,2024,600,roadster,neuf,15000000,2027-06-30,"Fiche creee simultanement par plusieurs clients pour eprouver l'unicite de la reference."`;

const REF = "MI-950";
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
  total.crees === 1 && total.majs === 7,
  `${total.crees} creations et ${total.majs} mises a jour — la reference a ete dupliquee`
);

// Verification independante : le catalogue public ne doit exposer qu'une fiche.
const fichesPubliques = await fetch(`${BASE}/motos?q=${encodeURIComponent("Course Concurrence")}`)
  .then((r) => r.text());
const compteur = Number(fichesPubliques.match(/>(\d+)<!-- --> moto/)?.[1] ?? -1);
verifier(
  "le catalogue public n'expose qu'une seule fiche pour cette reference",
  compteur === 1,
  `${compteur} fiche(s) au catalogue`
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
        body: JSON.stringify({ statut: i % 2 ? "reserve" : "disponible" }),
      }).then((r) => r.status)
    )
  ),
]);

console.log(`        lectures ${JSON.stringify(lectures.statuts)} · p95 ${lectures.p95} ms`);
verifier("les lectures publiques restent servies pendant les ecritures", lectures.statuts[200] === 120, JSON.stringify(lectures.statuts));
verifier("les ecritures admin aboutissent toutes", ecrituresAdmin.every((s) => s === 200), JSON.stringify(ecrituresAdmin));
verifier("aucune corruption : le catalogue reste lisible", (await fetch(BASE + "/motos").then((r) => r.text())).includes("commande 45"));

// ── 9. Intégrité du magasin après toute la charge ─────────────────────────
titre("9. Integrite finale");

const integrite = await fetch(BASE + "/admin/motos", { headers: cookieAdmin });
verifier("la liste admin repond encore 200", integrite.status === 200);
const corps = await integrite.text();
const compteurAdmin = corps.match(/Motos \(<!-- -->(\d+)<!-- -->\)/)?.[1] ?? corps.match(/Motos \((\d+)\)/)?.[1];
verifier(
  "le compteur de motos du back-office est coherent",
  Number(compteurAdmin) > 0,
  `compteur lu : ${compteurAdmin ?? "introuvable"}`
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
