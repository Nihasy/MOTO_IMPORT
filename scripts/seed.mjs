/**
 * Jeu de données de démonstration : 10 motos complètes, photos incluses.
 * Le CDC fixe 8 à 12 motos comme condition de recette (15).
 *
 *   npm run seed
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const RACINE = process.cwd();
const CIBLE = process.env.LOCAL_DB_PATH ?? path.join(RACINE, "data", "local-db.json");

const slugifier = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const construireSlug = (marque, modele, annee, ref) =>
  slugifier(`${marque} ${modele} ${annee} ${ref.replace(/-/g, "")}`);

const jours = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const ilYA = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

// Photos de démonstration : cinq clichés réels servis depuis `public/demo`,
// tournés d'une vue à l'autre. Des visuels de moto plutôt que des cartouches
// SVG donnent un aperçu fidèle du rendu de production — cadrage, découpe en
// 4:3, poids des images. Aucune dépendance réseau.
const DEMO = [
  { fichier: "/demo/1.jpeg", largeur: 1199, hauteur: 1600 },
  { fichier: "/demo/2.jpeg", largeur: 1199, hauteur: 1600 },
  { fichier: "/demo/3.jpeg", largeur: 1199, hauteur: 1600 },
  { fichier: "/demo/4.jpeg", largeur: 1600, hauteur: 1199 },
  { fichier: "/demo/5.jpeg", largeur: 1600, hauteur: 1199 },
];
const PHOTO = (i) => DEMO[i % DEMO.length];

const PLAN_NEUF = [
  ["34ad", "34_avant_droit", "3/4 avant droit"],
  ["pd", "profil_droit", "Profil droit"],
  ["34ag", "34_arriere_gauche", "3/4 arrière gauche"],
  ["fa", "face_avant", "Face avant"],
  ["cpt", "compteur", "Compteur"],
  ["mot", "moteur", "Moteur"],
  ["pav", "pneu_avant", "Pneu avant"],
  ["par", "pneu_arriere", "Pneu arrière"],
  ["sel", "selle", "Selle et commandes"],
];
const PLAN_OCCASION = [
  ...PLAN_NEUF,
  ["cha", "chassis", "Numéro de châssis"],
  ["def1", "defaut", "Point d'usure : carénage"],
  ["def2", "defaut", "Point d'usure : pneu arrière"],
];

// Paragraphe propre aux motos deja sur place. Le reste du site le dit deja
// (bandeau de la carte, ligne de reassurance de la fiche), mais la description
// est ce que reprennent Facebook et Google : y laisser un texte qui parle
// d'importation sur commande contredit l'argument de vente le plus fort.
const DISPO_IMMEDIATE = `Cette moto est déjà à Antananarivo, dans notre local. Vous n'attendez pas les quarante-cinq à soixante-cinq jours d'importation : vous pouvez venir la voir avant de signer, puis repartir avec dès le solde réglé. Le fret et le dédouanement sont déjà réglés, la carte grise sera établie à votre nom comme sur toute commande, et le prix affiché reste le prix final. Un seul exemplaire est concerné : c'est le premier bon de commande signé qui l'emporte.`;

const texte = (marque, modele, cc, categorie, etat, statut) =>
  `La ${marque} ${modele} est une ${categorie} de ${cc} cm³ que nous avons retenue pour une raison simple : elle encaisse les routes malgaches sans réclamer un atelier tous les mois. Sur les axes défoncés autour de Tana comme sur la RN7, la partie-cycle reste saine et la selle ne devient pas un supplice au bout d'une heure.

Le moteur privilégie la souplesse à la performance pure. Vous avez du couple disponible dès les bas régimes, ce qui compte davantage dans les embouteillages d'Analakely qu'une puissance maximale atteinte à un régime que vous n'utiliserez jamais. La consommation reste contenue, autour de quatre litres aux cent kilomètres en usage mixte.

L'entretien est le vrai argument. Les pièces d'usure courantes se trouvent sur place ou s'acheminent rapidement, et la mécanique ne demande pas d'outillage spécifique. C'est un critère que nous appliquons systématiquement avant d'inscrire un modèle au catalogue : une moto impossible à entretenir localement est une moto que nous refusons de vendre, quel que soit son prix d'achat en Chine.

${
  etat === "occasion"
    ? "Ce véhicule d'occasion a été contrôlé au dépôt avant expédition. Les points d'usure constatés sont photographiés et listés plus haut, sans exception : nous préférons une occasion honnête à une occasion maquillée, et vous saurez exactement ce que vous achetez avant de signer."
    : "Ce véhicule est neuf, livré avec sa garantie constructeur et sa carte grise établie à votre nom. Le prix affiché est le prix final rendu à Antananarivo : ni frais de dossier, ni supplément de dédouanement à la livraison."
}${statut === "dispo_immediate" ? `\n\n${DISPO_IMMEDIATE}` : ""}`;

const MOTOS = [
  { ref: "MI-001", marque: "Honda", modele: "CB500X", annee: 2023, cc: 471, cat: "trail", etat: "neuf", prix: 14_500_000, ch: 47, poids: 199, selle: 834, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Rouge Grand Prix", garantie: 12, garantieTexte: "Moteur, boîte et partie-cycle", forts: ["ABS de série", "Selle accessible", "Consommation contenue"], statut: "disponible" },
  { ref: "MI-002", marque: "Yamaha", modele: "MT-03", annee: 2023, cc: 321, cat: "roadster", etat: "neuf", prix: 11_900_000, ch: 42, poids: 168, selle: 780, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Noir mat", garantie: 12, garantieTexte: "Moteur et boîte", forts: ["Légère et maniable", "Idéale premier gros cube", "ABS"], statut: "disponible" },
  { ref: "MI-003", marque: "Honda", modele: "Rebel 500", annee: 2021, cc: 471, cat: "custom", etat: "occasion", km: 18_400, prix: 12_500_000, ch: 46, poids: 191, selle: 690, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Noir", forts: ["Selle très basse", "Couple à bas régime", "Entretien simple"], statut: "disponible", usure: ["Rayure superficielle sur le carénage droit", "Pneu arrière à 40 % d'usure", "Selle légèrement marquée à l'avant"] },
  { ref: "MI-004", marque: "Kawasaki", modele: "Versys-X 300", annee: 2022, cc: 296, cat: "trail", etat: "occasion", km: 12_100, prix: 10_800_000, ch: 40, poids: 175, selle: 815, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Vert", forts: ["Réservoir de 17 litres", "Protection correcte", "Roue avant de 19 pouces"], statut: "reserve", usure: ["Protège-mains droit fendu", "Traces d'oxydation sur les fixations de top-case"] },
  { ref: "MI-005", marque: "Suzuki", modele: "V-Strom 650", annee: 2022, cc: 645, cat: "trail", etat: "neuf", prix: 21_500_000, ch: 71, poids: 216, selle: 835, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Jaune Champion", garantie: 12, garantieTexte: "Moteur, boîte et partie-cycle", forts: ["Bicylindre coupleux", "Confort sur longue distance", "Réputation de fiabilité"], statut: "dispo_immediate" },
  { ref: "MI-006", marque: "Yamaha", modele: "YZ 250F", annee: 2023, cc: 250, cat: "motocross", etat: "neuf", prix: 16_200_000, ch: 45, poids: 105, selle: 965, refroid: "liquide", trans: "5 rapports", abs: false, couleur: "Bleu", garantie: 6, garantieTexte: "Moteur", forts: ["Châssis compétition", "Suspensions réglables", "Poids contenu"], statut: "disponible" },
  { ref: "MI-007", marque: "Honda", modele: "CBR650R", annee: 2022, cc: 649, cat: "sportive", etat: "occasion", km: 9_600, prix: 23_900_000, ch: 95, poids: 208, selle: 810, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Rouge", forts: ["Quatre cylindres", "Sonorité pleine", "Entretien suivi"], statut: "disponible", usure: ["Repose-pied gauche légèrement râpé", "Pneu avant à 50 %"] },
  { ref: "MI-008", marque: "KTM", modele: "390 Duke", annee: 2023, cc: 373, cat: "roadster", etat: "neuf", prix: 13_400_000, ch: 44, poids: 167, selle: 820, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Orange", garantie: 12, garantieTexte: "Moteur et boîte", forts: ["Rapport poids-puissance", "Écran TFT", "Freinage mordant"], statut: "dispo_immediate" },
  { ref: "MI-009", marque: "Royal Enfield", modele: "Himalayan 411", annee: 2022, cc: 411, cat: "trail", etat: "occasion", km: 22_800, prix: 9_800_000, ch: 24, poids: 199, selle: 800, refroid: "air", trans: "5 rapports", abs: true, couleur: "Granit", forts: ["Mécanique simple", "Pièces disponibles", "Couple à bas régime"], statut: "vendu", dateVente: jours(-12), usure: ["Réservoir marqué côté gauche", "Chaîne à remplacer sous 3 000 km", "Sabot moteur rayé"] },
  { ref: "MI-010", marque: "Kawasaki", modele: "Z900", annee: 2023, cc: 948, cat: "roadster", etat: "neuf", prix: 29_500_000, ch: 125, poids: 212, selle: 830, refroid: "liquide", trans: "6 rapports", abs: true, couleur: "Noir métal", garantie: 12, garantieTexte: "Moteur, boîte et partie-cycle", forts: ["Quatre cylindres 948 cm³", "Modes de conduite", "Traction control"], statut: "disponible" },
];

const FOURNISSEURS = [
  { nom: "Guangzhou Moto Trading", ville_chine: "Guangzhou", specialite: "Trail et roadster japonais", contact: "wechat: gz-moto-trade", notes: "Partenaire principal. Contrôle avant expédition inclus." },
  { nom: "Chongqing Wheels Export", ville_chine: "Chongqing", specialite: "Sportives et grosses cylindrées", contact: "wechat: cq-wheels", notes: "Délais plus longs, meilleurs prix sur les 600+." },
  { nom: "Foshan Custom Bikes", ville_chine: "Foshan", specialite: "Custom et motocross", contact: "wechat: fs-custom", notes: "Petits volumes, qualité de préparation soignée." },
];

const now = new Date().toISOString();

const fournisseurs = FOURNISSEURS.map((f) => ({ id: randomUUID(), ...f, created_at: now }));
const motos = [];
const medias = [];

MOTOS.forEach((m, index) => {
  const id = randomUUID();
  const plan = m.etat === "occasion" ? PLAN_OCCASION : PLAN_NEUF;
  const datePhotos = m.etat === "occasion" ? jours(-20 - index) : null;

  motos.push({
    id,
    reference: m.ref,
    slug: construireSlug(m.marque, m.modele, m.annee, m.ref),
    marque: m.marque,
    modele: m.modele,
    annee: m.annee,
    cylindree: m.cc,
    categorie: m.cat,
    etat: m.etat,
    statut: m.statut,
    kilometrage: m.km ?? null,
    couleur: m.couleur ?? null,
    puissance_ch: m.ch ?? null,
    poids_kg: m.poids ?? null,
    hauteur_selle_mm: m.selle ?? null,
    refroidissement: m.refroid ?? null,
    transmission: m.trans ?? null,
    abs: Boolean(m.abs),
    prix_ttc: m.prix,
    prix_valable_jusqu_au: jours(index === 1 ? 4 : 120 + index * 5), // MI-002 : alerte d'échéance
    delai_min_jours: 45,
    delai_max_jours: 65,
    // Seul le neuf est garanti, selon la marque et le concessionnaire. Une
    // occasion part a zero quoi qu'annonce la fiche source (CGV art. 8).
    garantie_mois: m.etat === "occasion" ? 0 : (m.garantie ?? 0),
    garantie_texte: m.etat === "occasion" ? null : (m.garantieTexte ?? null),
    description: texte(m.marque, m.modele, m.cc, m.cat, m.etat, m.statut),
    points_forts: m.forts ?? [],
    etat_details: m.usure ? { points_usure: m.usure } : null,
    date_photos: datePhotos,
    fournisseur_id: fournisseurs[index % fournisseurs.length].id,
    date_vente: m.dateVente ?? null,
    vues: Math.floor(Math.random() * 240),
    created_at: ilYA(60 - index * 5),
    updated_at: ilYA(index),
  });

  plan.forEach(([, vue, libelle], i) => {
    const photo = PHOTO(index + i);
    medias.push({
      id: randomUUID(),
      moto_id: id,
      type: "photo",
      origine: i === 0 || m.etat === "occasion" ? "reelle" : i % 4 === 3 ? "constructeur" : "reelle",
      vue,
      cloudinary_id: photo.fichier,
      largeur: photo.largeur,
      hauteur: photo.hauteur,
      blurhash: null,
      ordre: i + 1,
      legende: libelle,
      alt: `${m.marque} ${m.modele} ${m.annee} - ${libelle}`,
      date_prise: datePhotos,
      lot_id: null,
      created_at: now,
    });
  });
});

const demandes = [
  { ref: "MI-001", nom: "Rado R.", tel: "+261341234567", source: "facebook", statut: "contrat_signe", jours: 24 },
  { ref: "MI-003", nom: "Hery A.", tel: "+261329876543", source: "tiktok", statut: "rdv_fixe", jours: 9 },
  { ref: "MI-005", nom: "Miora T.", tel: "+261335551122", source: "instagram", statut: "contacte", jours: 4 },
  { ref: "MI-002", nom: "Tojo N.", tel: "+261347778899", source: "facebook", statut: "nouveau", jours: 1 },
  { ref: null, nom: "Fara L.", tel: "+261340001122", source: "google", statut: "nouveau", jours: 0, budget: 12_000_000, message: "Je cherche un trail autour de 12 millions, pour la RN7." },
].map((d) => {
  const moto = d.ref ? motos.find((m) => m.reference === d.ref) : null;
  return {
    id: randomUUID(),
    moto_id: moto?.id ?? null,
    reference: d.ref,
    nom: d.nom,
    telephone: d.tel,
    budget_max: d.budget ?? null,
    message: d.message ?? null,
    source: d.source,
    statut: d.statut,
    notes: null,
    ip_hash: randomUUID().replace(/-/g, "").slice(0, 32),
    created_at: ilYA(d.jours),
    updated_at: ilYA(d.jours),
  };
});

const base = { motos, medias, demandes, fournisseurs, import_lots: [] };

await mkdir(path.dirname(CIBLE), { recursive: true });
await writeFile(CIBLE, JSON.stringify(base, null, 2), "utf8");

const parStatut = motos.reduce((a, m) => ({ ...a, [m.statut]: (a[m.statut] ?? 0) + 1 }), {});
console.log(`Base de démonstration écrite : ${CIBLE}`);
console.log(`  ${motos.length} motos (${JSON.stringify(parStatut)})`);
console.log(`  ${medias.length} photos, ${demandes.length} demandes, ${fournisseurs.length} fournisseurs`);
