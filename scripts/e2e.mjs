/**
 * Recette automatisée sur un serveur réellement démarré.
 * Couvre le chapitre 16 : parcours public, sécurité, API, back-office.
 *
 *   npm run build && npm start &   puis   npm run test:e2e
 */
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const COMPTE = { email: "nihasy@moto-import.mg", motdepasse: "moto-import-2026" };

import { chargerEnvLocal, exigerBaseDeTest, secretSession } from "./env-local.mjs";

await chargerEnvLocal();
exigerBaseDeTest("La recette e2e");

let reussis = 0;
const echecs = [];
let groupe = "";

const titre = (t) => {
  groupe = t;
  console.log(`\n${t}`);
};

const verifier = (nom, condition, detail = "") => {
  if (condition) {
    reussis++;
    console.log(`  OK   ${nom}`);
  } else {
    echecs.push(`${groupe} > ${nom}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ECHEC ${nom}${detail ? ` — ${detail}` : ""}`);
  }
};

const get = async (chemin, opts = {}) => {
  const r = await fetch(BASE + chemin, { redirect: "manual", ...opts });
  const texte = r.headers.get("content-type")?.includes("application/json")
    ? JSON.stringify(await r.json())
    : await r.text();
  return { statut: r.status, texte, entetes: r.headers, emplacement: r.headers.get("location") };
};

const attendreServeur = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + "/motos", { redirect: "manual" });
      if (r.status < 500) return true;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

if (!(await attendreServeur())) {
  console.error(`Serveur injoignable sur ${BASE}. Lancez « npm start » d'abord.`);
  process.exit(1);
}

// ── 1. Pages publiques ────────────────────────────────────────────────────
titre("1. Pages publiques");
for (const [chemin, attendu] of [
  // L'accroche est inchangée, mais le hero coupe désormais la ligne avant
  // « moto » pour passer la fin en or : « Votre prochaine moto » n'est plus
  // d'un seul tenant dans le HTML, « moto vous attend » l'est.
  ["/", "moto vous attend"],
  ["/motos", "Trier par"],
  ["/comment-ca-marche", "acompte"],
  // L'acompte n'est plus un taux fixe : il se calcule par moto. La FAQ
  // l'annonce en fourchette, d'ou un reperage sur le mot plutot que sur
  // un pourcentage qui bougera encore.
  ["/faq", "acompte"],
  ["/contact", "WhatsApp"],
  ["/cgv", "Article 4"],
  ["/mentions-legales", "Hébergement"],
  ["/plus", "Comment ça marche"],
  ["/enregistrees", "enregistrées"],
]) {
  const r = await get(chemin);
  verifier(`${chemin} répond 200`, r.statut === 200, `statut ${r.statut}`);
  verifier(`${chemin} contient son contenu clé`, r.texte.includes(attendu));
}

const r404 = await get("/motos/moto-qui-nexiste-pas");
verifier("une fiche inconnue renvoie 404", r404.statut === 404, `statut ${r404.statut}`);

// ── 2. Catalogue et filtres ───────────────────────────────────────────────
titre("2. Catalogue et filtres (16.1)");
const catalogue = await get("/motos");
const nbTotal = Number(catalogue.texte.match(/>(\d+)<!-- --> moto/)?.[1] ?? 0);
verifier("le compteur affiche au moins 8 motos", nbTotal >= 8, `${nbTotal} motos`);

const budget = await get("/motos?max=12000000");
const nbBudget = Number(budget.texte.match(/>(\d+)<!-- --> moto/)?.[1] ?? -1);
verifier("le filtre budget réduit le sous-ensemble", nbBudget >= 0 && nbBudget < nbTotal, `${nbBudget} vs ${nbTotal}`);

const trail = await get("/motos?cat=trail");
verifier("le filtre catégorie répond 200", trail.statut === 200);
verifier("un lien pré-filtré partagé est restitué", trail.texte.includes("Trail"));

const cumul = await get("/motos?cat=trail&max=15000000&etat=neuf");
verifier("les filtres se cumulent sans erreur", cumul.statut === 200);

const masque = await get("/motos?masquer_vendues=1");
const nbMasque = Number(masque.texte.match(/>(\d+)<!-- --> moto/)?.[1] ?? -1);
verifier("masquer les vendues retire au moins une fiche", nbMasque < nbTotal, `${nbMasque} vs ${nbTotal}`);
verifier("les vendues sont visibles par défaut", catalogue.texte.includes("Vendu"));

const vide = await get("/motos?max=1000");
verifier("le résultat vide propose l'action WhatsApp", vide.texte.includes("wa.me"));
verifier("le résultat vide explique le sourcing sur commande", vide.texte.includes("sourçons"));

const recherche = await get("/motos?q=yamaha");
verifier("la recherche textuelle fonctionne", recherche.statut === 200 && recherche.texte.includes("Yamaha"));

// ── 3. Fiche produit ──────────────────────────────────────────────────────
titre("3. Fiche produit (16.1)");
const slug = catalogue.texte.match(/href="\/motos\/([a-z0-9-]+)"/)?.[1];
verifier("le catalogue expose des liens de fiche", Boolean(slug), String(slug));

const fiche = await get(`/motos/${slug}`);
verifier("la fiche répond 200", fiche.statut === 200);
// Exigence CGV 2.1 : la carte grise figure sous le prix, sans exception. La
// casse, elle, depend de la place du mot dans la phrase selon le statut.
verifier("la carte grise est mentionnée", /carte grise établie à votre nom/i.test(fiche.texte));

// Le bloc prix depend du statut : la premiere fiche du catalogue est une
// « disponible de suite », triee en tete, qui n'affiche ni trajet, ni acompte,
// ni date de validite. Les deux redactions sont donc testees chacune sur une
// fiche du statut correspondant.
const surCommande = await get("/motos/honda-cb500x-2023-mi001");
verifier("sur commande, le prix porte la mention rendu Tana", surCommande.texte.includes("Prix final, rendu à Antananarivo"));
// Le bloc prix affiche le partage en deux colonnes — « À la commande » et
// « À la remise des clés » — avec le pourcentage propre à la moto, et non
// plus un taux unique écrit en toutes lettres.
verifier(
  "sur commande, l'acompte chiffré est affiché",
  surCommande.texte.includes("À la commande") && /\d+\s*%/.test(surCommande.texte)
);
verifier("sur commande, le délai est affiché", /45\D{0,20}65/.test(surCommande.texte));
verifier("sur commande, la date de validité du prix est affichée", surCommande.texte.includes("Prix valable jusqu"));

const surPlace = await get("/motos/suzuki-v-strom-650-2022-mi005");
verifier("sur place, le véhicule est annoncé déjà au local", surPlace.texte.includes("Véhicule déjà au local"));
verifier("sur place, aucun délai d'importation n'est promis", surPlace.texte.includes("Aucun délai d"));
verifier("sur place, « rendu à Antananarivo » disparaît", !surPlace.texte.includes("Prix final, rendu à Antananarivo"));
verifier("sur place, aucun acompte n'est réclamé", !surPlace.texte.includes("À la commande"));
verifier("sur place, la date de validité du prix disparaît", !surPlace.texte.includes("Prix valable jusqu"));
verifier("sur place, le parcours d'importation n'est pas décrit", !surPlace.texte.includes("Nous importons"));
verifier("le bouton devis pointe vers WhatsApp", fiche.texte.includes("wa.me"));
verifier("les données structurées Vehicle sont présentes", fiche.texte.includes('"@type":"Vehicle"'));
verifier("l'offre Schema.org est présente", fiche.texte.includes('"@type":"Offer"'));
verifier("Open Graph pointe vers l'image dédiée", fiche.texte.includes("opengraph-image"));
// Le titre du bloc passe en deux tons — « Comment » en blanc, la suite en
// or — donc « Comment ça se passe » n'est plus d'un seul tenant dans le
// HTML. La seconde moitie, elle, l'est.
verifier("les 5 étapes sont rappelées sur la fiche", fiche.texte.includes("ça se passe"));
verifier("des motos similaires sont proposées", fiche.texte.includes("Motos similaires"));

const urlOg = fiche.texte.match(/property="og:image" content="([^"]+)"/)?.[1];
verifier("la balise og:image est presente", Boolean(urlOg), String(urlOg));
const og = await get(new URL(urlOg ?? "/", BASE).pathname + (new URL(urlOg ?? "/", BASE).search));
verifier("l'image Open Graph est générée", og.statut === 200, `statut ${og.statut}`);
verifier("l'image OG est bien une image", (og.entetes.get("content-type") ?? "").startsWith("image/"));

// Fiche occasion : bloc état obligatoire
const occasion = await get("/motos/honda-rebel-500-2021-mi003");
verifier("la fiche occasion affiche le bloc état du véhicule", occasion.texte.includes("État du véhicule"));
verifier("les points d'usure sont listés honnêtement", occasion.texte.includes("usure"));
verifier("la date de prise de vue est affichée", occasion.texte.includes("Photos prises le"));

// Fiche vendue : bouton adapté
const vendue = await get("/motos/royal-enfield-himalayan-411-2022-mi009");
verifier("une fiche vendue reste en ligne (pas de 404)", vendue.statut === 200);
verifier("une fiche vendue propose « Trouvez-moi la même »", vendue.texte.includes("Trouvez-moi la même"));
verifier("le message WhatsApp d'une vendue est adapté", vendue.texte.includes(encodeURIComponent("est vendue")));

// ── 4. Fuite fournisseur (12.2) ───────────────────────────────────────────
titre("4. Non-régression fournisseur (12.2)");
const pagesPubliques = ["/", "/motos", `/motos/${slug}`, "/enregistrees", "/sitemap.xml", "/robots.txt"];
for (const p of pagesPubliques) {
  const r = await get(p);
  verifier(`${p} ne contient aucune donnée fournisseur`, !/fournisseur/i.test(r.texte));
}
const fournisseursSeed = ["Guangzhou Moto Trading", "Chongqing Wheels Export", "Foshan Custom Bikes"];
for (const p of pagesPubliques) {
  const r = await get(p);
  verifier(
    `${p} ne cite aucun nom de fournisseur`,
    !fournisseursSeed.some((f) => r.texte.includes(f))
  );
}

// ── 5. Sécurité et accès ──────────────────────────────────────────────────
titre("5. Sécurité (16.2)");
for (const p of ["/admin", "/admin/motos", "/admin/import", "/admin/demandes", "/admin/fournisseurs"]) {
  const r = await get(p);
  verifier(`${p} est inaccessible sans session`, r.statut === 307 || r.statut === 302, `statut ${r.statut}`);
  verifier(`${p} redirige vers la connexion`, (r.emplacement ?? "").includes("/connexion"));
}

const entetes = (await get("/motos")).entetes;
verifier("X-Frame-Options est posé", entetes.get("x-frame-options") === "DENY");
verifier("X-Content-Type-Options est posé", entetes.get("x-content-type-options") === "nosniff");
verifier("Referrer-Policy est posé", Boolean(entetes.get("referrer-policy")));
verifier("Content-Security-Policy est posée", Boolean(entetes.get("content-security-policy")));

const robots = await get("/robots.txt");
verifier("robots.txt bloque /admin", robots.texte.includes("/admin"));
verifier("robots.txt déclare le sitemap", robots.texte.includes("sitemap"));

const sitemap = await get("/sitemap.xml");
verifier("le sitemap liste les fiches", (sitemap.texte.match(/\/motos\//g) ?? []).length >= 8);
verifier("le sitemap n'expose pas /admin", !sitemap.texte.includes("/admin"));

// API protégées
for (const [chemin, methode] of [
  ["/api/import/motos", "POST"],
  ["/api/import/medias", "POST"],
  ["/api/upload/signature", "POST"],
  ["/api/import/lots/00000000-0000-0000-0000-000000000000", "DELETE"],
]) {
  const r = await get(chemin, { method: methode, headers: { "Content-Type": "application/json" }, body: methode === "POST" ? "{}" : undefined });
  verifier(`${methode} ${chemin} refuse l'anonyme`, r.statut === 401, `statut ${r.statut}`);
}

const demandesGet = await get("/api/demandes");
verifier("GET /api/demandes refuse l'anonyme", demandesGet.statut === 401);

// ── 6. API demandes ───────────────────────────────────────────────────────
titre("6. API demandes (11)");
const creerDemande = (charge) =>
  get("/api/demandes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": charge.ip ?? "10.0.0.1" },
    body: JSON.stringify(charge.corps),
  });

const d1 = await creerDemande({ ip: "10.0.0.10", corps: { reference: "MI-001", source: "facebook", message: "Recette e2e" } });
verifier("une demande valide est créée", d1.statut === 201, `statut ${d1.statut} ${d1.texte}`);
verifier("la réponse ne renvoie que l'identifiant", !/fournisseur|ip_hash/.test(d1.texte));

const d2 = await creerDemande({ ip: "10.0.0.11", corps: { source: "pas_une_source" } });
verifier("une source invalide est rejetée", d2.statut === 400, `statut ${d2.statut}`);
verifier("l'erreur est normalisée { erreur, champ }", d2.texte.includes('"erreur"') && d2.texte.includes('"champ"'));

let bloquee = false;
for (let i = 0; i < 7; i++) {
  const r = await creerDemande({ ip: "10.0.0.99", corps: { reference: "MI-001" } });
  if (r.statut === 429) bloquee = true;
}
verifier("la limitation de débit bloque au-delà de 5/min", bloquee);

// ── 7. Back-office authentifié ────────────────────────────────────────────
titre("7. Back-office (16.1)");
const form = new URLSearchParams();
form.set("email", COMPTE.email);
form.set("motdepasse", COMPTE.motdepasse);

// Connexion via l'action serveur : on passe par le cookie signé directement.
const connexion = await fetch(BASE + "/connexion", { redirect: "manual" });
verifier("la page de connexion est accessible", connexion.status === 200);

// On rejoue la signature du jeton comme le fait lib/auth.
const { createHmac } = await import("node:crypto");
const secret = secretSession();
const charge = Buffer.from(
  JSON.stringify({ email: COMPTE.email, role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 })
).toString("base64url");
const jeton = `${charge}.${createHmac("sha256", secret).update(charge).digest("base64url")}`;
const cookie = { Cookie: `mi_session=${jeton}` };

const admin = await get("/admin", { headers: cookie });
verifier("le tableau de bord est accessible avec session", admin.statut === 200, `statut ${admin.statut}`);
verifier("le tableau de bord liste les demandes nouvelles", admin.texte.includes("Demandes non traitées"));
verifier("le tableau de bord alerte sur les prix expirants", admin.texte.includes("échéance"));
// Le tableau de bord ne liste plus « Photos insuffisantes » en bloc : depuis
// le verrou de publication, un brouillon incomplet est normal et une fiche
// publiee incomplete est une alerte. Les deux sections n'apparaissent que
// lorsqu'elles ont quelque chose a dire ; le compteur, lui, est toujours la.
verifier("le tableau de bord compte les motos en ligne", admin.texte.includes("Motos en ligne"));
verifier("le tableau de bord mene a la creation d'une fiche", admin.texte.includes("Nouvelle moto"));

const adminMotos = await get("/admin/motos", { headers: cookie });
verifier("la liste des motos est accessible", adminMotos.statut === 200);
verifier("la liste affiche le compteur de photos", adminMotos.texte.includes("photos"));

const adminFournisseurs = await get("/admin/fournisseurs", { headers: cookie });
verifier("l'admin accède aux fournisseurs", adminFournisseurs.statut === 200 && adminFournisseurs.texte.includes("Guangzhou"));

// Un éditeur ne doit pas voir les fournisseurs.
const chargeEditeur = Buffer.from(
  JSON.stringify({ email: "editrice@moto-import.mg", role: "editeur", exp: Math.floor(Date.now() / 1000) + 3600 })
).toString("base64url");
const jetonEditeur = `${chargeEditeur}.${createHmac("sha256", secret).update(chargeEditeur).digest("base64url")}`;
const editeurFournisseurs = await get("/admin/fournisseurs", {
  headers: { Cookie: `mi_session=${jetonEditeur}` },
});
verifier("un éditeur n'accède pas aux fournisseurs", editeurFournisseurs.texte.includes("Accès refusé"));
verifier("aucun nom de fournisseur n'est rendu à l'éditeur", !editeurFournisseurs.texte.includes("Guangzhou"));

// ── 8. Bascule de statut ──────────────────────────────────────────────────
titre("8. Bascule de statut (10.2)");
// La premiere ligne du back-office est la derniere modifiee, donc souvent une
// « disponible de suite » : la repasser en « disponible » est refuse par le
// controle de coherence description/statut, a raison. On bascule une fiche
// dont la description ne promet aucune disponibilite particuliere.
const posMI001 = adminMotos.texte.indexOf("MI-001");
const idMoto = adminMotos.texte
  .slice(Math.max(0, posMI001 - 1200), posMI001 + 1200)
  .match(/\/admin\/motos\/([0-9a-f-]{36})/)?.[1];
verifier("un identifiant de moto est trouvé", Boolean(idMoto));

const basculer = (statut) =>
  get(`/api/motos/${idMoto}/statut`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...cookie },
    body: JSON.stringify({ statut }),
  });

const versVendu = await basculer("vendu");
verifier("la bascule vers vendu réussit", versVendu.statut === 200, versVendu.texte);
verifier("date_vente est renseignée automatiquement", /"date_vente":"\d{4}-\d{2}-\d{2}"/.test(versVendu.texte));

const versDispo = await basculer("disponible");
verifier("le retour à disponible réussit", versDispo.statut === 200);
verifier("date_vente est effacée", versDispo.texte.includes('"date_vente":null'));

const statutInvalide = await basculer("liquidation");
verifier("un statut hors énumération est refusé", statutInvalide.statut === 400);

const sansSession = await get(`/api/motos/${idMoto}/statut`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ statut: "vendu" }),
});
verifier("la bascule est refusée sans session", sansSession.statut === 401);

// ── 9. Import CSV ─────────────────────────────────────────────────────────
titre("9. Import CSV (7.4)");
const ENTETE_CSV =
  "reference,marque,modele,annee,cylindree,categorie,etat,kilometrage,prix_yuan,prix_valable_jusqu_au,garantie_mois,garantie_texte,description,points_forts,fournisseur,statut";
const ligneCsv = (ref, prix = "12000") =>
  `${ref},Suzuki,GSX-S750,2023,749,roadster,neuf,,${prix},2027-01-31,24,Moteur et boite,Roadster quatre cylindres importe sur commande.,Confort|Freinage,Guangzhou Moto Trading,disponible`;

const importer = (csv) =>
  get("/api/import/motos", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cookie },
    body: JSON.stringify({ csv, fichier_nom: "recette.csv" }),
  });

// Les références du fichier refusé ne sont écrites par aucun autre point de la
// recette : leur absence reste vraie au second passage, là où un contrôle sur
// MI-901 signalait à tort la fiche laissée par la veille.
const csvInvalide = [ENTETE_CSV, ligneCsv("MI-909"), ligneCsv("MI-910", "gratuit"), ligneCsv("MI-911")].join("\n");
const refus = await importer(csvInvalide);
verifier("un CSV avec une ligne invalide est refusé en bloc", refus.statut === 422, `statut ${refus.statut}`);
verifier("le rapport indique la ligne fautive", refus.texte.includes('"ligne":3'));
verifier("le rapport indique la colonne fautive", refus.texte.includes('"colonne":"prix_yuan"'));

const apresRefus = await get("/admin/motos", { headers: cookie });
verifier(
  "aucune ligne du fichier refusé n'a été écrite",
  !apresRefus.texte.includes("MI-909") && !apresRefus.texte.includes("MI-911")
);

const csvValide = [ENTETE_CSV, ligneCsv("MI-901"), ligneCsv("MI-903")].join("\n");
const ok = await importer(csvValide);
verifier("un CSV valide est importé", ok.statut === 200, ok.texte.slice(0, 200));
// L'import est idempotent par référence : au second passage les deux fiches
// sont mises à jour au lieu d'être créées, et la recette doit rester verte.
const bilan = JSON.parse(ok.texte || "{}");
verifier(
  "les deux lignes sont enregistrées",
  (bilan.crees ?? 0) + (bilan.mis_a_jour ?? 0) === 2,
  `crees ${bilan.crees}, mis_a_jour ${bilan.mis_a_jour}`
);

const reimport = await importer(csvValide);
verifier("un réimport met à jour au lieu de dupliquer", reimport.texte.includes('"mis_a_jour":2'));

const apresImport = await get("/admin/motos", { headers: cookie });
verifier("les motos importées apparaissent au back-office", apresImport.texte.includes("MI-901"));
verifier("aucun doublon de référence", (apresImport.texte.match(/MI-901/g) ?? []).length <= 2);

// Le CSV crée les fiches avant les photos (7.4). Une ligne qui réclame
// « disponible » est donc retenue en brouillon par le verrou du 7.1.
// L'import place desormais toute ligne en brouillon, quel que soit le statut
// ecrit dans le fichier : aucune fiche ne se publie d'elle-meme, donc aucune
// n'a besoin d'etre « retenue ». Le compte ne vaut plus que pour une fiche
// deja en vente qu'une mise a jour rendrait incomplete. Qu'aucune fiche
// importee n'atteigne le catalogue est verifie juste en dessous.
verifier(
  "aucune ligne importée n'entre en vente d'elle-même",
  bilan.retenus_en_brouillon === 0,
  `retenus ${bilan.retenus_en_brouillon}`
);

const publique = await get("/motos");
verifier("une fiche retenue en brouillon n'est pas publiée", !publique.texte.includes("GSX-S750"));
verifier("le fournisseur résolu ne fuit pas côté public", !/fournisseur/i.test(publique.texte));

// ── 10. Import médias et annulation de lot ────────────────────────────────
titre("10. Import médias et annulation de lot (7.3)");
const listeAdmin = await get("/admin/motos", { headers: cookie });
const idCible = listeAdmin.texte.match(/\/admin\/motos\/([0-9a-f-]{36})/)?.[1];

const media = (ordre) => ({
  moto_id: idCible,
  type: "photo",
  origine: "reelle",
  vue: "autre",
  cloudinary_id: `recette/e2e-${ordre}`,
  largeur: 1600,
  hauteur: 1200,
  ordre: 900 + ordre,
  alt: "Photo de recette",
});

const lot = await get("/api/import/medias", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...cookie },
  body: JSON.stringify({ fichier_nom: "lot-recette", medias: [media(1), media(2), media(3)] }),
});
verifier("un lot de médias est enregistré", lot.statut === 200, lot.texte.slice(0, 200));
verifier("les trois médias sont acceptés", lot.texte.includes('"reussis":3'));

const lotId = JSON.parse(lot.texte).lot_id;
const mediaOrphelin = await get("/api/import/medias", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...cookie },
  body: JSON.stringify({
    fichier_nom: "orphelin",
    medias: [{ ...media(9), moto_id: "00000000-0000-0000-0000-000000000000" }],
  }),
});
verifier("un média orphelin est signalé en échec", mediaOrphelin.texte.includes('"echoues":1'));

const annulation = await get(`/api/import/lots/${lotId}`, { method: "DELETE", headers: cookie });
verifier("l'annulation du lot réussit", annulation.statut === 200, annulation.texte);
verifier("elle supprime exactement les 3 médias du lot", annulation.texte.includes('"medias_supprimes":3'));

const apresAnnulation = await get(`/admin/motos/${idCible}?onglet=photos`, { headers: cookie });
verifier("les médias annulés ont disparu", !apresAnnulation.texte.includes("e2e-1"));

// ── 11. Contrôles de publication ──────────────────────────────────────────
titre("11. Contrôles avant publication (10.3)");
// L'identifiant est celui de la ligne MI-901 : se raccrocher au premier lien
// de la liste attraperait une moto du jeu de démonstration, complète, et les
// contrôles ne prouveraient plus rien.
const posMI901 = apresImport.texte.indexOf("MI-901");
// Le lien porte l'identifiant et precede immediatement la reference dans la
// ligne : on prend donc le dernier lien situe AVANT « MI-901 », et non le
// premier d'une fenetre de largeur fixe. Cette fenetre attrapait le lien de la
// ligne precedente des que la largeur du balisage changeait, et la recette
// archivait alors une autre fiche en croyant tester celle-ci.
const liensAvantMI901 = [...apresImport.texte
  .slice(0, posMI901)
  .matchAll(/\/admin\/motos\/([0-9a-f-]{36})/g)];
const idImportee = liensAvantMI901.at(-1)?.[1];
verifier("la fiche importée MI-901 est retrouvée au back-office", Boolean(idImportee));
const fichePhotos = await get(`/admin/motos/${idImportee}?onglet=photos`, { headers: cookie });
verifier("l'onglet photos affiche les contrôles", fichePhotos.texte.includes("Publication bloquée") || fichePhotos.texte.includes("Prête à publier"));
verifier("le plan de prise de vue est contrôlé", fichePhotos.texte.includes("Plan de prise de vue"));
verifier("le texte alternatif est contrôlé", fichePhotos.texte.includes("alternatif"));

// Le verrou est serveur, pas seulement affiché : la route PATCH doit refuser
// elle-même la mise en vente d'une fiche incomplète (7.1, recette 16.1).
const misEnVente = await get(`/api/motos/${idImportee}/statut`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...cookie },
  body: JSON.stringify({ statut: "disponible" }),
});
verifier("la mise en vente d'une fiche sans photo est refusée", misEnVente.statut === 422, `statut ${misEnVente.statut}`);
verifier("le refus énumère les points bloquants", misEnVente.texte.includes("Plan de prise de vue"));

const catalogueAvant = await get("/motos");
verifier("la fiche incomplète n'a pas atteint le catalogue", !catalogueAvant.texte.includes("GSX-S750"));

// Trois angles suffisent depuis l'allègement du plan (7.1) : ni compteur, ni
// moteur, ni pneus, ni selle. La recette le prouve sur le serveur, la règle
// étant celle qui décide de ce qui part en ligne.
const vueExigee = (ordre, vue) => ({
  moto_id: idImportee,
  type: "photo",
  origine: "reelle",
  vue,
  // Chemin local servable : un identifiant Cloudinary factice ferait échouer
  // `next/image` sur le catalogue une fois la fiche publiée.
  cloudinary_id: `/demo/${ordre}.jpeg`,
  largeur: 1600,
  hauteur: 1200,
  ordre,
  alt: `Suzuki GSX-S750 2023 - ${vue}`,
});
const troisAngles = await get("/api/import/medias", {
  method: "POST",
  headers: { "Content-Type": "application/json", ...cookie },
  body: JSON.stringify({
    fichier_nom: "trois-angles",
    medias: [
      vueExigee(1, "34_avant_droit"),
      vueExigee(2, "34_arriere_gauche"),
      vueExigee(3, "face_avant"),
    ],
  }),
});
verifier("les trois vues exigées sont enregistrées", troisAngles.texte.includes('"reussis":3'));

const publiee = await get(`/api/motos/${idImportee}/statut`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...cookie },
  body: JSON.stringify({ statut: "disponible" }),
});
verifier(
  "trois angles suffisent à publier, sans compteur ni moteur ni pneus",
  publiee.statut === 200,
  publiee.texte.slice(0, 200)
);

const catalogueApres = await get("/motos");
verifier("la fiche publiée rejoint le catalogue", catalogueApres.texte.includes("GSX-S750"));

const versArchive = await get(`/api/motos/${idImportee}/statut`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", ...cookie },
  body: JSON.stringify({ statut: "archive" }),
});
verifier("le retrait reste toujours possible", versArchive.statut === 200, versArchive.texte.slice(0, 120));

// La recette rend la fiche à son état d'avant : lot de photos annulé, fiche
// archivée. Sans cela, le second passage partirait d'une moto déjà publiable.
const lotTroisAngles = JSON.parse(troisAngles.texte || "{}").lot_id;
if (lotTroisAngles) {
  await get(`/api/import/lots/${lotTroisAngles}`, { method: "DELETE", headers: cookie });
}

const toujoursAbsente = await get("/motos");
verifier("la fiche retirée quitte le catalogue", !toujoursAbsente.texte.includes("GSX-S750"));

// ── 12. Ergonomie du back-office ──────────────────────────────────────────
titre("12. Back-office : navigation et filtres (10.1, 10.2, 10.5)");

const tableauBord = await get("/admin", { headers: cookie });
verifier("le tableau de bord distingue les brouillons des fiches publiées",
  tableauBord.texte.includes("Brouillons en cours") || tableauBord.texte.includes("Prêtes à publier"),
  "aucune section de brouillon");
verifier("la navigation signale l'onglet courant", tableauBord.texte.includes('aria-current="page"'));
verifier("le back-office donne accès au site public", tableauBord.texte.includes("Voir le site"));

// Recherche et filtres de la liste : l'URL doit porter l'état.
const rechercheAdmin = await get("/admin/motos?q=GSX-S750", { headers: cookie });
verifier("la recherche retrouve une fiche par modèle", rechercheAdmin.texte.includes("MI-901"));
verifier("la recherche exclut les autres fiches", !rechercheAdmin.texte.includes("MI-001"));

const introuvable = await get("/admin/motos?q=zzzzintrouvable", { headers: cookie });
verifier("une recherche sans résultat le dit", introuvable.texte.includes("Aucune fiche ne correspond"));

const filtreBrouillons = await get("/admin/motos?statut=brouillon", { headers: cookie });
// MI-901 vient d'etre archivee au chapitre 11 : le brouillon encore attendu
// ici est MI-903, la ligne sans photo retenue par l'import. Les deux sens sont
// verifies, sans quoi un filtre qui laisse tout passer serait declare bon.
verifier("le filtre brouillon isole les fiches non publiées", filtreBrouillons.texte.includes("MI-903"));
verifier("le filtre brouillon exclut une fiche archivée", !filtreBrouillons.texte.includes("MI-901"));

const filtreEnLigne = await get("/admin/motos?statut=en_ligne", { headers: cookie });
verifier("le filtre en ligne exclut les brouillons", !filtreEnLigne.texte.includes("MI-901"));

const groupeInvente = await get("/admin/motos?statut=nimportequoi", { headers: cookie });
verifier("un filtre inventé retombe sur « Toutes »", groupeInvente.statut === 200 && groupeInvente.texte.includes("MI-001"));

// Filtres du CRM.
const parPeriode = await get("/admin/demandes?periode=7j", { headers: cookie });
verifier("le CRM filtre par période", parPeriode.statut === 200 && parPeriode.texte.includes("7 jours"));

const periodeInventee = await get("/admin/demandes?periode=depuis-toujours", { headers: cookie });
verifier("une période inventée ne casse pas l'écran", periodeInventee.statut === 200);

const cumulFiltres = await get("/admin/demandes?periode=30j&source=facebook&vue=kanban", { headers: cookie });
verifier("les filtres du CRM se cumulent sans s'annuler",
  cumulFiltres.statut === 200 && cumulFiltres.texte.includes("periode=30j") && cumulFiltres.texte.includes("source=facebook"));

// Suppression : plus jamais atteignable en un seul geste.
const editionMoto = await get(`/admin/motos/${idImportee}`, { headers: cookie });
verifier("la suppression demande une confirmation explicite",
  editionMoto.texte.includes("Supprimer définitivement cette moto"));
verifier("la fiche d'édition affiche le verrou de publication",
  editionMoto.texte.includes("à corriger avant de pouvoir mettre cette fiche en vente")
    || editionMoto.texte.includes("peut passer en vente"));

// ── 13. Nettoyage ─────────────────────────────────────────────────────────
titre("13. Nettoyage");
verifier("la recette est terminée", true);

// ── Bilan ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Recette : ${reussis} vérifications réussies, ${echecs.length} échec(s).`);
if (echecs.length) {
  console.log("\nÉchecs :");
  for (const e of echecs) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("Tous les points de recette automatisables sont au vert.");
