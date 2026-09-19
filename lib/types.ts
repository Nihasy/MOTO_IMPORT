export const ETATS = ["neuf", "occasion"] as const;
export const STATUTS = [
  "brouillon", "dispo_immediate", "disponible", "reserve", "vendu", "archive",
] as const;
export const CATEGORIES = [
  "routiere", "sportive", "roadster", "trail", "custom", "motocross", "scooter",
] as const;
export const MEDIA_TYPES = ["photo", "video"] as const;
export const ORIGINES = ["reelle", "constructeur"] as const;
export const VUES = [
  "34_avant_droit", "profil_droit", "34_arriere_gauche", "face_avant",
  "compteur", "moteur", "pneu_avant", "pneu_arriere", "selle",
  "chassis", "echappement", "defaut", "autre",
] as const;
export const DEMANDE_STATUTS = ["nouveau", "contacte", "rdv_fixe", "contrat_signe", "perdu"] as const;
export const DEMANDE_SOURCES = ["facebook", "instagram", "tiktok", "google", "direct", "bouche_a_oreille"] as const;

export type Etat = (typeof ETATS)[number];
export type Statut = (typeof STATUTS)[number];
export type Categorie = (typeof CATEGORIES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type Origine = (typeof ORIGINES)[number];
export type Vue = (typeof VUES)[number];
export type DemandeStatut = (typeof DEMANDE_STATUTS)[number];
export type DemandeSource = (typeof DEMANDE_SOURCES)[number];

export type Media = {
  id: string;
  moto_id: string;
  type: MediaType;
  origine: Origine;
  vue: Vue;
  cloudinary_id: string;
  largeur: number;
  hauteur: number;
  blurhash: string | null;
  ordre: number;
  legende: string | null;
  alt: string;
  date_prise: string | null;
  lot_id?: string | null;
  created_at: string;
};

/** Moto telle qu'exposée au public : jamais de fournisseur_id. */
export type MotoPublique = {
  id: string;
  reference: string;
  slug: string;
  marque: string;
  modele: string;
  annee: number;
  cylindree: number;
  categorie: Categorie;
  etat: Etat;
  statut: Statut;
  kilometrage: number | null;
  couleur: string | null;
  puissance_ch: number | null;
  poids_kg: number | null;
  hauteur_selle_mm: number | null;
  refroidissement: "air" | "liquide" | null;
  transmission: string | null;
  abs: boolean;
  /** Prix de vente, calculé à partir du prix d'achat (lib/tarification.ts). */
  prix_ttc: number;
  /** Acompte propre à la moto, en % du prix (CGV art. 4.2). Public. */
  acompte_pct: number | null;
  prix_valable_jusqu_au: string;
  delai_min_jours: number;
  delai_max_jours: number;
  garantie_mois: number;
  garantie_texte: string | null;
  description: string;
  points_forts: string[];
  etat_details: { points_usure?: string[]; note?: string } | null;
  date_photos: string | null;
  date_vente: string | null;
  vues: number;
  created_at: string;
  updated_at: string;
};

/**
 * Moto côté serveur/admin. Le fournisseur et le prix d'achat sont internes :
 * `publier()` les retire avant toute exposition, et la base en refuse la
 * lecture au rôle public (migration 0009).
 */
export type Moto = MotoPublique & {
  fournisseur_id: string | null;
  /** Prix d'achat en yuan. Interne. */
  prix_yuan: number | null;
  /** Taux ¥ → Ar du dernier calcul. Interne. */
  taux_yuan: number | null;
  /**
   * Statut sous lequel la fiche partira en vente : sur commande, ou déjà au
   * local (« Disponible de suite »). Décidé dès la saisie, parce qu'une fiche
   * naît en brouillon et se publie souvent plus tard, en masse.
   */
  mise_en_vente: MiseEnVente;
};

export const MISES_EN_VENTE = ["commande", "local"] as const;
export type MiseEnVente = (typeof MISES_EN_VENTE)[number];

/**
 * Mise en vente d'une fiche. Les fiches enregistrées avant la colonne n'en
 * ont pas : une moto déjà « disponible de suite » est au local, les autres
 * partent sur commande.
 */
export const miseEnVenteDe = (m: { mise_en_vente?: MiseEnVente | null; statut: Statut }): MiseEnVente =>
  m.mise_en_vente ?? (m.statut === "dispo_immediate" ? "local" : "commande");

/** Statut public correspondant à la mise en vente prévue. */
export const statutDeMiseEnVente = (m: MiseEnVente): Statut => (m === "local" ? "dispo_immediate" : "disponible");

export const LIBELLE_MISE_EN_VENTE: Record<MiseEnVente, string> = {
  commande: "Sur commande — importée après signature, 45 à 65 jours",
  local: "Déjà au local — disponible de suite",
};

/**
 * `nb_medias` porte le nombre reel de photos quand `medias` a ete tronquee
 * pour l'affichage : la carte n'en montre que cinq mais le compteur doit
 * indiquer le total.
 */
export type MotoAvecMedias = MotoPublique & {
  medias: Media[];
  nb_medias?: number;
};

/** Une ligne d'horaires telle qu'affichée : « Lundi – vendredi » / « 8 h 30 – 17 h 30 ». */
export type LigneHoraire = { jours: string; heures: string };

/**
 * Coordonnées du local, modifiables depuis le back-office. Elles vivent en
 * base plutôt qu'en variables d'environnement : une variable `NEXT_PUBLIC_*`
 * est figée à la construction, et changer un horaire imposait un redéploiement.
 */
export type Parametres = {
  adresse: string;
  horaires: LigneHoraire[];
  /** Numéro WhatsApp, chiffres seuls avec indicatif (261…). */
  whatsapp: string;
  /** Numéro à appeler, tel qu'affiché. */
  telephone: string;
};

export type Fournisseur = {
  id: string;
  nom: string;
  contact: string | null;
  ville_chine: string | null;
  specialite: string | null;
  notes: string | null;
  created_at: string;
};

export type Demande = {
  id: string;
  moto_id: string | null;
  reference: string | null;
  nom: string | null;
  telephone: string | null;
  budget_max: number | null;
  message: string | null;
  source: DemandeSource;
  statut: DemandeStatut;
  notes: string | null;
  ip_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportLot = {
  id: string;
  type: "motos_csv" | "medias_masse";
  fichier_nom: string | null;
  total: number;
  reussis: number;
  echoues: number;
  rapport: unknown;
  auteur_id: string | null;
  created_at: string;
};

export const LIBELLE_STATUT: Record<Statut, string> = {
  brouillon: "Brouillon",
  dispo_immediate: "Disponible de suite",
  disponible: "Disponible sur commande",
  reserve: "Réservé",
  vendu: "Vendu",
  archive: "Archivé",
};

/**
 * Statuts visibles du public. `brouillon` couvre la fiche en cours de
 * préparation, `archive` la fiche erronée : ni l'une ni l'autre ne doit
 * apparaître au catalogue, dans le sitemap ou sur une URL partagée.
 *
 * Une fiche vendue reste publique : la retirer produirait des 404 sur les
 * liens déjà partagés et détruirait le référencement acquis (13.1).
 */
export const STATUTS_PUBLICS = ["dispo_immediate", "disponible", "reserve", "vendu"] as const;

export const estPublic = (s: Statut): boolean =>
  (STATUTS_PUBLICS as readonly string[]).includes(s);

/**
 * Statuts qui proposent activement le véhicule à la vente. Ce sont les seuls
 * dont l'accès est conditionné aux contrôles avant publication (10.3) : on
 * doit toujours pouvoir marquer une moto vendue ou la retirer, même si sa
 * fiche est incomplète.
 */
export const STATUTS_EN_VENTE = ["dispo_immediate", "disponible", "reserve"] as const;

export const estEnVente = (s: Statut): boolean =>
  (STATUTS_EN_VENTE as readonly string[]).includes(s);

export const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  routiere: "Routière",
  sportive: "Sportive",
  roadster: "Roadster",
  trail: "Trail",
  custom: "Custom",
  motocross: "Cross",
  scooter: "Scooter",
};

export const LIBELLE_VUE: Record<Vue, string> = {
  "34_avant_droit": "3/4 avant droit",
  profil_droit: "Profil droit",
  "34_arriere_gauche": "3/4 arrière gauche",
  face_avant: "Face avant",
  compteur: "Compteur",
  moteur: "Moteur",
  pneu_avant: "Pneu avant",
  pneu_arriere: "Pneu arrière",
  selle: "Selle et commandes",
  chassis: "Numéro de châssis",
  echappement: "Échappement",
  defaut: "Point d'usure",
  autre: "Autre",
};

export const LIBELLE_DEMANDE_STATUT: Record<DemandeStatut, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  rdv_fixe: "RDV fixé",
  contrat_signe: "Contrat signé",
  perdu: "Perdu",
};

/** Ordre de tri public : disponible, réservé, vendu. */
/**
 * Ordre d'affichage au catalogue. Une moto livrable tout de suite passe devant
 * une commande a 45 jours : c'est l'argument de vente le plus fort.
 */
export const POIDS_STATUT: Record<Statut, number> = {
  dispo_immediate: 0,
  disponible: 1,
  reserve: 2,
  vendu: 3,
  brouillon: 4,
  archive: 5,
};
