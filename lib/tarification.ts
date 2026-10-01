import { ACOMPTE_MAX, ACOMPTE_MIN } from "@/lib/conditions";
import { CATEGORIES, type Categorie, type Statut } from "@/lib/types";

/**
 * Tarification dynamique — INFORMATION INTERNE.
 *
 * Le prix de vente ne se saisit plus : il se calcule à partir du prix d'achat
 * en yuan et des réglages ci-dessous. Rien de ce module ne doit atteindre une
 * page publique hormis le prix de vente et le pourcentage d'acompte.
 *
 *   achat (Ar)      = prix en ¥ × taux
 *   caisse (Ar)     = caisse bois en ¥ × taux, payée au fournisseur avec la moto
 *   fret (Ar)       = volume de la caisse × $/m³ × taux du dollar
 *                     + frais de dossier, selon la cylindrée
 *   coût de revient = achat + caisse + fret
 *   bénéfice        = fixe + part × achat, ou la marge saisie sur la fiche
 *   prix de vente   = coût + bénéfice, arrondi au palier supérieur
 *   acompte         = (achat + caisse) × (1 + sécurité change) ÷ prix, arrondi
 *                     au 5 % supérieur, borné par les CGV (45 à 80 %)
 *
 * L'acompte couvre ainsi ce qui se paie au fournisseur dès la signature, et le
 * solde couvre le fret, payé à l'arrivée à Tana : aucune moto n'engage de
 * capital. Le bénéfice croît avec le prix sans jamais sauter d'un palier à
 * l'autre — une moto plus chère à l'achat rapporte toujours plus.
 *
 * Le fret suit le volume réel (décision du 01/10/2026) : un fret fixe
 * surfacturait un petit roadster et sous-facturait une GS Adventure. Le volume
 * est celui de la fiche quand il y est saisi — la caisse mesurée par
 * l'entrepôt —, sinon le volume standard de sa catégorie.
 *
 * Ce module est importé par le formulaire du back-office, donc livré au
 * navigateur : il ne contient AUCUN chiffre. Les réglages par défaut vivent
 * dans `tarification-defaut.ts`, que seul le serveur importe.
 */
export type Reglages = {
  /** 1 ¥ = … Ar. */
  taux_yuan: number;
  /** 1 $ = … Ar : le fret maritime se paie en dollars. */
  taux_usd: number;
  /** Fret maritime, en dollars par mètre cube. */
  fret_usd_m3: number;
  /** Volume standard de la caisse par catégorie (m³), quand la fiche n'en porte pas. */
  volumes_m3: Record<Categorie, number>;
  /** Frais de dossier d'une moto sous le seuil de cylindrée (Ar). */
  dossier_ar: number;
  /** Frais de dossier d'une grosse cylindrée (Ar). */
  dossier_gros_ar: number;
  /**
   * Cylindrée à partir de laquelle le gros dossier s'applique (cm³). Sous
   * 1 000 pour qu'une « 1000 » de 998 ou 999 cm³ compte comme telle.
   */
  seuil_gros_cc: number;
  /**
   * Caisse en bois (¥), payée au fournisseur avec la moto : l'acompte la
   * couvre comme l'achat, mais elle ne porte pas de marge.
   */
  caisse_yuan: number;
  /** Bénéfice minimum par moto (Ar). */
  benefice_fixe_ar: number;
  /** Part du prix d'achat ajoutée au bénéfice (%). */
  part_achat_pct: number;
  /** Marge de sécurité sur le change, pour l'acompte (%). */
  securite_change_pct: number;
  /** Palier d'arrondi du prix de vente (Ar). */
  arrondi_ar: number;
};

/** Ce qui, sur une fiche, décide de son fret et de sa marge. */
export type Gabarit = {
  categorie: Categorie;
  cylindree: number;
  /** Volume propre à la fiche (m³) ; vide, le standard de la catégorie s'applique. */
  volume_m3?: number | null;
  /**
   * Marge fixée à la main pour cette fiche (Ar). Elle remplace le bénéfice
   * calculé — une affaire négociée, une moto à écouler, un modèle très
   * demandé. Zéro est une marge : la moto part à prix coûtant. Vide, le
   * calcul automatique s'applique.
   */
  marge_ar?: number | null;
};

export type Calcul = {
  achat_ar: number;
  /** Caisse en bois, payée avec l'achat. */
  caisse_ar: number;
  cout_ar: number;
  /** Volume retenu pour cette moto (fiche ou standard de la catégorie). */
  volume_m3: number;
  /** Part du fret due au volume. */
  transport_ar: number;
  /** Part du fret due aux frais de dossier. */
  dossier_ar: number;
  /** Fret payé à l'arrivée : transport + dossier. */
  fret_ar: number;
  prix_ar: number;
  benefice_ar: number;
  /** Le bénéfice vient-il d'une marge saisie sur la fiche ? */
  marge_manuelle: boolean;
  acompte_pct: number;
  acompte_ar: number;
  solde_ar: number;
  /** Ce que l'acompte, plafonné par les CGV, ne couvre pas de l'achat et de la caisse (Ar). */
  capital_avance_ar: number;
  /** Le solde paie-t-il le fret à l'arrivée ? */
  solde_couvre_fret: boolean;
};

const arrondiSup = (n: number, pas: number) => Math.ceil(n / pas) * pas;

/** Volume retenu pour une moto : le sien s'il est saisi, sinon celui de sa catégorie. */
export const volumePour = (r: Reglages, g: Gabarit) => g.volume_m3 || r.volumes_m3[g.categorie];

/** Frais de dossier applicables à une cylindrée. */
export const dossierPour = (r: Reglages, cylindree: number) =>
  cylindree >= r.seuil_gros_cc ? r.dossier_gros_ar : r.dossier_ar;

export function calculerPrix(prixYuan: number, r: Reglages, g: Gabarit): Calcul {
  const volume_m3 = volumePour(r, g);
  const transport_ar = Math.round(volume_m3 * r.fret_usd_m3 * r.taux_usd);
  const dossier_ar = dossierPour(r, g.cylindree);
  const fret_ar = transport_ar + dossier_ar;
  const achat_ar = Math.round(prixYuan * r.taux_yuan);
  const caisse_ar = Math.round(r.caisse_yuan * r.taux_yuan);
  const cout_ar = achat_ar + caisse_ar + fret_ar;
  const marge_manuelle = g.marge_ar !== null && g.marge_ar !== undefined;
  const marge = marge_manuelle ? g.marge_ar! : r.benefice_fixe_ar + (achat_ar * r.part_achat_pct) / 100;
  const brut = cout_ar + marge;
  const prix_ar = arrondiSup(Math.round(brut), Math.max(1, r.arrondi_ar));

  const aCouvrir = (achat_ar + caisse_ar) * (1 + r.securite_change_pct / 100);
  // Epsilon : 0,55 × 20 vaut 11,000000000000002 en virgule flottante, et
  // l'arrondi supérieur passerait à tort au palier suivant.
  const requis = Math.ceil((aCouvrir / prix_ar) * 20 - 1e-9) * 5;
  const acompte_pct = Math.min(ACOMPTE_MAX, Math.max(ACOMPTE_MIN, requis));
  const acompte_ar = Math.round((prix_ar * acompte_pct) / 100);
  const solde_ar = prix_ar - acompte_ar;

  return {
    achat_ar,
    caisse_ar,
    cout_ar,
    volume_m3,
    transport_ar,
    dossier_ar,
    fret_ar,
    prix_ar,
    benefice_ar: prix_ar - cout_ar,
    marge_manuelle,
    acompte_pct,
    acompte_ar,
    solde_ar,
    capital_avance_ar: Math.max(0, achat_ar + caisse_ar - acompte_ar),
    solde_couvre_fret: solde_ar >= fret_ar,
  };
}

/**
 * Statuts dont le prix suit les réglages. Tous les autres sont figés :
 * - réservé et vendu, parce qu'un bon de commande a été signé (CGV 5.4) ;
 * - disponible de suite, parce que la moto est au local, achat et fret payés :
 *   son prix est calculé une dernière fois à l'arrivée, puis ne bouge plus ;
 * - archivé, parce qu'il n'est plus proposé.
 */
export const STATUTS_PRIX_DYNAMIQUE: readonly Statut[] = ["brouillon", "disponible"];

export const prixDynamique = (statut: Statut) => STATUTS_PRIX_DYNAMIQUE.includes(statut);

/**
 * Faut-il recalculer le prix quand une moto change de statut ? Oui en entrant
 * dans un statut dynamique (un désistement remet la moto au taux du jour), et
 * en arrivant au local (dernier calcul avant de figer).
 */
export const recalculerAuPassage = (cible: Statut) =>
  prixDynamique(cible) || cible === "dispo_immediate";

/** Validation des réglages saisis dans le back-office. */
export function erreurReglages(r: Reglages): string | null {
  const dans = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;
  if (!dans(r.taux_yuan, 50, 5_000)) return "Taux du yuan invalide : entre 50 et 5 000 Ar.";
  if (!dans(r.taux_usd, 500, 50_000)) return "Taux du dollar invalide : entre 500 et 50 000 Ar.";
  if (!dans(r.fret_usd_m3, 0, 10_000)) return "Fret au mètre cube invalide : entre 0 et 10 000 $.";
  if (!dans(r.dossier_ar, 0, 100_000_000) || !dans(r.dossier_gros_ar, 0, 100_000_000)) return "Frais de dossier invalides.";
  if (!dans(r.seuil_gros_cc, 1, 10_000)) return "Seuil de cylindrée invalide.";
  if (!dans(r.caisse_yuan, 0, 100_000)) return "Prix de la caisse invalide.";
  for (const c of CATEGORIES) {
    if (!dans(r.volumes_m3?.[c], 0.1, 10)) return `Volume « ${c} » invalide : entre 0,1 et 10 m³.`;
  }
  if (!dans(r.benefice_fixe_ar, 0, 100_000_000)) return "Bénéfice fixe invalide.";
  if (!dans(r.part_achat_pct, 0, 100)) return "Part du prix d'achat invalide : entre 0 et 100 %.";
  if (!dans(r.securite_change_pct, 0, 50)) return "Sécurité sur le change invalide : entre 0 et 50 %.";
  if (!dans(r.arrondi_ar, 1, 1_000_000)) return "Palier d'arrondi invalide.";
  return null;
}
