/**
 * Tests d'intrusion automatisés contre un serveur réellement démarré.
 * Chaque test tente activement une attaque ; « OK » signifie que l'attaque
 * a échoué, donc que la défense tient.
 *
 *   npm run build && npm start &   puis   npm run test:securite
 */
import { createHmac } from "node:crypto";
import { SECRET_DEV, chargerEnvLocal, secretSession } from "./env-local.mjs";

await chargerEnvLocal();

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const COMPTE = { email: "nihasy@moto-import.mg", motdepasse: "moto-import-2026" };

let reussis = 0;
const echecs = [];
let groupe = "";

const titre = (t) => {
  groupe = t;
  console.log(`\n${t}`);
};

const verifier = (nom, defenseTient, detail = "") => {
  if (defenseTient) {
    reussis++;
    console.log(`  OK    ${nom}`);
  } else {
    echecs.push({ groupe, nom, detail });
    console.log(`  FAILLE ${nom}${detail ? ` — ${detail}` : ""}`);
  }
};

const req = async (chemin, opts = {}) => {
  const { delai = 20_000, ...reste } = opts;
  const stop = AbortSignal.timeout(delai);
  try {
    const r = await fetch(BASE + chemin, { redirect: "manual", signal: stop, ...reste });
    return { statut: r.status, texte: await r.text(), entetes: r.headers, emplacement: r.headers.get("location") };
  } catch (e) {
    const expire = e.name === "TimeoutError" || e.cause?.code === "UND_ERR_HEADERS_TIMEOUT";
    return {
      statut: expire ? "delai depasse" : `erreur ${e.cause?.code ?? e.message}`,
      texte: "",
      entetes: new Headers(),
      emplacement: null,
    };
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

// Session légitime : forgée avec le secret RÉELLEMENT configuré, comme le
// ferait le serveur lui-même. Cela isole le test du protocole interne des
// Server Actions, tout en restant fidèle au format de jeton de production.
const SECRET = secretSession();

const forger = (charge, secret) => {
  const c = Buffer.from(JSON.stringify(charge)).toString("base64url");
  return `${c}.${createHmac("sha256", secret).update(c).digest("base64url")}`;
};
const dansUneHeure = () => Math.floor(Date.now() / 1000) + 3600;

const jetonAdmin = forger({ email: COMPTE.email, role: "admin", exp: dansUneHeure() }, SECRET);
const jetonEditeur = forger({ email: "editrice@moto-import.mg", role: "editeur", exp: dansUneHeure() }, SECRET);
const cookieAdmin = { Cookie: `mi_session=${jetonAdmin}` };
const cookieEditeur = { Cookie: `mi_session=${jetonEditeur}` };

// Connexion réelle par le formulaire, pour éprouver la vérification du mot de
// passe. Le protocole des Server Actions peut évoluer : si l'appel n'aboutit
// pas, les tests concernés sont signalés plutôt que déclarés réussis.
const pageConnexion = await fetch(BASE + "/connexion", { redirect: "manual" });
const htmlConnexion = await pageConnexion.text();
const actionId = htmlConnexion.match(/(?:\$ACTION_ID_|")([0-9a-f]{40})"?/)?.[1];

const seConnecter = async (email, motdepasse) => {
  if (!actionId) return { indisponible: true, statut: 0, jeton: "", cookie: "" };
  const r = await fetch(BASE + "/connexion", {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Next-Action": actionId,
      Origin: BASE,
    },
    body: new URLSearchParams({ "1_email": email, "1_motdepasse": motdepasse, "1_suite": "/admin" }).toString(),
  });
  const cookies = r.headers.getSetCookie?.() ?? [];
  const cookie = cookies.find((c) => c.startsWith("mi_session=")) ?? "";
  return {
    indisponible: false,
    statut: r.status,
    cookie,
    jeton: cookie.split(";")[0].replace("mi_session=", ""),
  };
};

// ── A. Authentification et sessions ───────────────────────────────────────
titre("A. Authentification et sessions");

const connexionReelle = await seConnecter(COMPTE.email, COMPTE.motdepasse);
if (connexionReelle.indisponible) {
  console.log("  NOTE  connexion par Server Action non pilotable, tests de mot de passe ignores");
} else if (connexionReelle.cookie) {
  verifier("le cookie de session est HttpOnly", /HttpOnly/i.test(connexionReelle.cookie), connexionReelle.cookie);
  verifier("le cookie de session est SameSite", /SameSite=(Lax|Strict)/i.test(connexionReelle.cookie), connexionReelle.cookie);
}

const chargeAdmin = { email: "intrus@ailleurs.com", role: "admin", exp: dansUneHeure() };

// Le vrai secret de repli, celui qu'on lit dans le depot public — et non une
// valeur inventee que le serveur n'a jamais utilisee, qui faisait passer le
// test sans rien eprouver.
const jetonSecretParDefaut = forger(chargeAdmin, SECRET_DEV);
const attaqueSecretDefaut = await req("/admin/fournisseurs", {
  headers: { Cookie: `mi_session=${jetonSecretParDefaut}` },
});
verifier(
  "un jeton forge avec le secret par defaut du code est refuse",
  attaqueSecretDefaut.statut !== 200 || !attaqueSecretDefaut.texte.includes("Guangzhou"),
  `statut ${attaqueSecretDefaut.statut} — AUTH_SECRET non defini : n'importe qui peut se forger une session admin`
);

// Signature vide / absente.
for (const [nom, jeton] of [
  ["signature vide", Buffer.from(JSON.stringify(chargeAdmin)).toString("base64url") + "."],
  ["signature nulle", Buffer.from(JSON.stringify(chargeAdmin)).toString("base64url") + ".AAAA"],
  ["jeton sans point", Buffer.from(JSON.stringify(chargeAdmin)).toString("base64url")],
  ["jeton vide", ""],
  ["jeton non base64", "%%%.%%%"],
]) {
  const r = await req("/admin", { headers: { Cookie: `mi_session=${jeton}` } });
  verifier(`un jeton a ${nom} est refuse`, r.statut !== 200, `statut ${r.statut}`);
}

// Jeton expiré.
const expire = forger({ email: COMPTE.email, role: "admin", exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
verifier(
  "un jeton expire est refuse",
  (await req("/admin", { headers: { Cookie: `mi_session=${expire}` } })).statut !== 200
);

// Force brute sur le mot de passe.
if (!connexionReelle.indisponible) {
  let refuses = 0;
  for (let i = 0; i < 12; i++) {
    if (!(await seConnecter(COMPTE.email, `essai-${i}`)).jeton) refuses++;
  }
  verifier("12 mots de passe errones sont tous refuses", refuses === 12, `${refuses}/12`);
}

// ── B. Elevation de privilege ─────────────────────────────────────────────
titre("B. Elevation de privilege et controle d'acces");

{
  const f = await req("/admin/fournisseurs", { headers: cookieEditeur });
  verifier(
    "un editeur ne lit pas les fournisseurs",
    !f.texte.includes("Guangzhou") && !f.texte.includes("Chongqing"),
    "noms de fournisseurs exposes a un editeur"
  );

  const lot = await req("/api/import/lots/00000000-0000-0000-0000-000000000000", {
    method: "DELETE",
    headers: cookieEditeur,
  });
  verifier("un editeur ne peut pas annuler un lot", lot.statut === 403, `statut ${lot.statut}`);
}

// Contournement du middleware par variation de casse et encodage.
for (const chemin of [
  "/ADMIN",
  "/admin/",
  "/admin/motos/",
  "/admin/%2e%2e/admin",
  "/admin//motos",
  "/./admin",
]) {
  const r = await req(chemin);
  const bloque = r.statut === 307 || r.statut === 302 || r.statut === 404 || r.statut === 308;
  verifier(`${chemin} n'expose pas le back-office`, bloque, `statut ${r.statut}`);
}

// Ecriture non authentifiee sur chaque route.
const ecritures = [
  ["POST", "/api/import/motos", '{"csv":"x"}'],
  ["POST", "/api/import/medias", '{"medias":[]}'],
  ["POST", "/api/upload/signature", "{}"],
  ["PATCH", "/api/motos/00000000-0000-0000-0000-000000000000/statut", '{"statut":"vendu"}'],
  ["PATCH", "/api/demandes/00000000-0000-0000-0000-000000000000", '{"statut":"perdu"}'],
  ["POST", "/api/revalidate", "{}"],
  ["DELETE", "/api/import/lots/00000000-0000-0000-0000-000000000000", null],
  ["GET", "/api/demandes", null],
];
for (const [methode, chemin, corps] of ecritures) {
  const r = await req(chemin, {
    method: methode,
    headers: { "Content-Type": "application/json" },
    body: corps ?? undefined,
  });
  verifier(`${methode} ${chemin} refuse l'anonyme`, r.statut === 401 || r.statut === 403, `statut ${r.statut}`);
}

// ── C. Injection ──────────────────────────────────────────────────────────
titre("C. Injection");

const CHARGE_XSS = "</script><script>window.__COMPROMIS=1</script>";
const CSV_ENTETE =
  "reference,marque,modele,annee,cylindree,categorie,etat,prix_ttc,prix_valable_jusqu_au,description";

{
  const csv = `${CSV_ENTETE}\n"MI-777","Xss","Test",2023,500,trail,neuf,9000000,2027-01-31,"${CHARGE_XSS} description de test suffisamment longue pour passer la validation."`;
  const imp = await req("/api/import/motos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cookieAdmin },
    body: JSON.stringify({ csv, fichier_nom: "xss.csv" }),
  });

  if (imp.statut === 200) {
    const fiche = await req("/motos/xss-test-2023-mi777");
    const blocJsonLd = fiche.texte.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
    )?.[1] ?? "";
    verifier(
      "les donnees structurees echappent la fermeture de balise script",
      !blocJsonLd.includes("</script") && !fiche.texte.includes("window.__COMPROMIS=1</script>"),
      "XSS stocke : une description peut fermer la balise <script> des donnees structurees"
    );
    const horsJsonLd = fiche.texte.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
      ""
    );
    verifier(
      "la description est echappee dans le corps de la page",
      !/<script>window\.__COMPROMIS/.test(horsJsonLd),
      "script injecte execute dans le corps"
    );
  } else {
    verifier("le jeu de test XSS a pu etre cree", false, `import refuse, statut ${imp.statut}`);
  }
}

// XSS reflechi par la recherche.
const reflechi = await req(`/motos?q=${encodeURIComponent("<img src=x onerror=alert(1)>")}`);
verifier(
  "la recherche ne reflechit pas de HTML brut",
  !reflechi.texte.includes("<img src=x onerror=alert(1)>"),
  "parametre q reflechi sans echappement"
);

// Pollution de prototype.
const pollution = await req("/api/demandes", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.0.1" },
  body: JSON.stringify({ reference: "MI-001", __proto__: { pollue: true }, constructor: { prototype: { pollue: true } } }),
});
const apresPollution = await req("/motos");
verifier(
  "la pollution de prototype n'affecte pas le serveur",
  apresPollution.statut === 200,
  `statut ${apresPollution.statut} apres tentative (creation: ${pollution.statut})`
);

// Traversee de repertoire sur le slug.
for (const slug of ["../../etc/passwd", "..%2f..%2fetc%2fpasswd", "%00", "....//....//"]) {
  const r = await req(`/motos/${slug}`);
  verifier(
    `le slug « ${slug} » ne lit pas de fichier`,
    !r.texte.includes("root:") && r.statut !== 500,
    `statut ${r.statut}`
  );
}

// Injection dans les filtres.
//
// L'assertion porte sur ce qui est dangereux — l'evaluation — et non sur la
// presence d'un echo. La version precedente cherchait la valeur restituee dans
// une puce « recherche … effacer » du HTML servi ; cette puce est desormais
// rendue cote client, la regex ne trouvait plus rien et le script concluait a
// cinq failles alors que rien n'etait evalue. Un test de securite qui crie au
// loup finit par ne plus etre lu.
for (const q of ["' OR 1=1--", "'; drop table motos;--", "${7*7}", "{{7*7}}", "<%= 7*7 %>"]) {
  const r = await req(`/motos?q=${encodeURIComponent(q)}`);

  // 1. La page repond, sans trace technique ni erreur serveur.
  // Une vraie trace, pas le mot « stack » : en developpement, React glisse dans
  // chaque page des metadonnees de debogage ("stack":[]) qui declenchaient le
  // test sur des pages parfaitement saines.
  const trace = /SyntaxError|at Object\.|at \S+ \([^)]*:\d+:\d+\)/;
  const repondSainement = r.statut === 200 && !trace.test(r.texte);

  // 2. Rien n'est evalue : 7*7 ne doit jamais valoir 49 la ou la valeur apparait.
  const zoneEcho = [...r.texte.matchAll(/.{0,80}7\*7.{0,80}/g)].map((m) => m[0]).join(" ");
  const nonEvalue = !zoneEcho.includes("49");

  // 3. Une charge contenant un chevron ne doit jamais ressortir telle quelle :
  //    si elle est restituee, c'est sous forme echappee. On ne teste pas la
  //    presence de « <script » dans la page — Next y place legitimement les
  //    siens, et le test se declencherait sur son propre bundle.
  const brutPasse = q.includes("<") && r.texte.includes(q);

  verifier(
    `le filtre traite « ${q} » comme du texte`,
    repondSainement && nonEvalue && !brutPasse,
    `statut ${r.statut}${nonEvalue ? "" : " · expression evaluee"}${brutPasse ? " · chevrons non echappes" : ""}`
  );
}

// ── D. Abus et deni de service ────────────────────────────────────────────
titre("D. Abus et deni de service");

// Contournement de la limitation par rotation de X-Forwarded-For.
// Corps de requête démesuré.
const gros = JSON.stringify({ reference: "MI-001", message: "A".repeat(5_000_000) });
let statutGros;
try {
  const r = await req("/api/demandes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.7" },
    body: gros,
  });
  statutGros = r.statut;
} catch (e) {
  statutGros = `erreur reseau (${e.code ?? e.message})`;
}
verifier(
  "un corps de 5 Mo est rejete",
  statutGros === 413 || statutGros === 400,
  `statut ${statutGros}`
);

{
  const csvEnorme =
    CSV_ENTETE +
    "\n" +
    Array.from({ length: 20_000 }, (_, i) =>
      `MI-${9000 + i},M,M,2023,500,trail,neuf,9000000,2027-01-31,"description de test suffisamment longue pour passer la validation Zod."`
    ).join("\n");
  const t0 = Date.now();
  const r = await req("/api/import/motos", {
    method: "POST",
    delai: 25_000,
    headers: { "Content-Type": "application/json", ...cookieAdmin },
    body: JSON.stringify({ csv: csvEnorme, fichier_nom: "enorme.csv" }),
  });
  const duree = Date.now() - t0;
  verifier(
    "un CSV de 20 000 lignes est refuse d'emblee",
    r.statut === 413 || r.statut === 422 || r.statut === 400,
    `statut ${r.statut} apres ${duree} ms — import non borne, saturation possible`
  );

  // Le serveur doit rester disponible juste apres.
  const apres = await req("/motos", { delai: 10_000 });
  verifier("le catalogue reste servi apres un import demesure", apres.statut === 200, `statut ${apres.statut}`);
}

// Chaque requete se presente sous une adresse differente : l'etage par
// adresse est neutralise par construction. Seul l'etage global peut tenir.
const TENTATIVES = 90;
let acceptees = 0;
let bloquees = 0;
for (let i = 0; i < TENTATIVES; i++) {
  const r = await req("/api/demandes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `203.0.113.${i % 250}` },
    body: JSON.stringify({ reference: "MI-001", message: "spam" }),
  });
  if (r.statut === 201) acceptees++;
  if (r.statut === 429) bloquees++;
}
verifier(
  "un etage global borne le flot malgre la falsification d'adresse",
  bloquees > 0 && acceptees < TENTATIVES,
  `${acceptees} acceptees / ${bloquees} bloquees sur ${TENTATIVES} — aucune borne globale`
);

// ── E. Fuite d'information ────────────────────────────────────────────────
titre("E. Fuite d'information");

const pagesPubliques = ["/", "/motos", "/faq", "/contact", "/sitemap.xml", "/robots.txt"];
for (const p of pagesPubliques) {
  const r = await req(p);
  verifier(`${p} ne fuit aucune donnee fournisseur`, !/fournisseur/i.test(r.texte));
  verifier(`${p} ne fuit aucun hachage d'IP`, !/ip_hash/i.test(r.texte));
}

const entetes = (await req("/motos")).entetes;
verifier(
  "l'en-tete X-Powered-By ne divulgue pas la pile",
  !entetes.get("x-powered-by"),
  `X-Powered-By: ${entetes.get("x-powered-by")}`
);

// Trace technique dans une erreur.
const erreur500 = await req("/api/demandes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{ ceci n'est pas du json",
});
verifier(
  "une requete malformee ne renvoie pas de trace technique",
  !/at \w+ \(|node_modules|\.ts:\d+/.test(erreur500.texte),
  erreur500.texte.slice(0, 120)
);

// Enumération : la réponse doit être identique pour un compte inexistant.
if (!connexionReelle.indisponible) {
  const inconnu = await seConnecter("inexistant@nulle-part.com", "x");
  const existantFaux = await seConnecter(COMPTE.email, "x");
  verifier(
    "aucune enumeration de comptes par le statut de reponse",
    inconnu.statut === existantFaux.statut,
    `${inconnu.statut} vs ${existantFaux.statut}`
  );
}

// ── F. En-tetes de securite ───────────────────────────────────────────────
titre("F. En-tetes de securite");

const h = (await req("/motos")).entetes;
const csp = h.get("content-security-policy") ?? "";

verifier("X-Frame-Options interdit le cadrage", h.get("x-frame-options") === "DENY");
verifier("X-Content-Type-Options est pose", h.get("x-content-type-options") === "nosniff");
verifier("Referrer-Policy est pose", Boolean(h.get("referrer-policy")));
verifier("Content-Security-Policy est posee", csp.length > 0);
verifier("la CSP interdit le cadrage", csp.includes("frame-ancestors 'none'"));
verifier("la CSP restreint base-uri", csp.includes("base-uri"));
verifier("la CSP restreint form-action", csp.includes("form-action"));
// En developpement, Next exige 'unsafe-eval' pour le rechargement a chaud, et
// HSTS n'a aucun sens sans TLS : next.config.mjs ne les pose qu'en production.
// Ces deux defenses ne se jugent donc que sur un serveur servi en HTTPS ;
// les exiger du serveur local produisait deux fausses failles a chaque passage.
if (BASE.startsWith("https://")) {
  verifier(
    "la CSP n'autorise pas eval",
    !csp.includes("'unsafe-eval'"),
    "script-src autorise 'unsafe-eval'"
  );
  verifier(
    "Strict-Transport-Security est pose",
    Boolean(h.get("strict-transport-security")),
    "HSTS absent : premiere visite interceptable en clair"
  );
} else {
  console.log("  —     CSP sans eval et HSTS : sans objet hors HTTPS, a juger sur la production");
}
verifier(
  "Cross-Origin-Opener-Policy est pose",
  Boolean(h.get("cross-origin-opener-policy")),
  "COOP absent"
);

// CORS : aucune route ne doit s'ouvrir a une origine tierce.
const cors = await req("/api/demandes", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
  body: JSON.stringify({ reference: "MI-001" }),
});
verifier(
  "aucun en-tete CORS permissif sur l'API",
  cors.entetes.get("access-control-allow-origin") !== "*",
  `ACAO: ${cors.entetes.get("access-control-allow-origin")}`
);

// ── G. Redirection ouverte ────────────────────────────────────────────────
titre("G. Redirection ouverte");

for (const cible of [
  "https://evil.example",
  "//evil.example",
  "/\\evil.example",
  "/admin/../../evil",
  "javascript:alert(1)",
]) {
  const r = await fetch(`${BASE}/connexion?suite=${encodeURIComponent(cible)}`, { redirect: "manual" });
  const corps = await r.text();
  const rendue = corps.match(/name="suite"[^>]*value="([^"]*)"/)?.[1]
    ?? corps.match(/value="([^"]*)"[^>]*name="suite"/)?.[1];
  verifier(
    `la destination « ${cible} » est ramenee a un chemin interne`,
    rendue !== undefined && /^\/admin(\/|$|\?)/.test(rendue),
    `champ suite rendu : ${rendue ?? "introuvable"}`
  );
}

// ── Bilan ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(64)}`);
console.log(`Securite : ${reussis} defenses tiennent, ${echecs.length} faille(s).`);
if (echecs.length) {
  console.log("\nFailles :");
  for (const e of echecs) console.log(`  - [${e.groupe}] ${e.nom}\n      ${e.detail}`);
  process.exit(1);
}
console.log("Aucune faille detectee.");
