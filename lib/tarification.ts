import { ACOMPTE_MAX, ACOMPTE_MIN } from "@/lib/conditions";
import type { Statut } from "@/lib/types";

/**
 * Tarification dynamique — INFORMATION INTERNE.
 *
 * Le prix de vente ne se saisit plus : il se calcule à partir du prix d'achat
 * en yuan et des réglages ci-dessous. Rien de ce module ne doit atteindre une
 * page publique hormis le prix de vente et le pourcentage d'acompte.
 *
 *   achat (Ar)      = prix en ¥ × taux
 *   coût de revient = achat + fret et papiers
 *   bénéfice        = fixe + part × achat
 *   prix de vente   = coût + bénéfice, arrondi au palier supérieur
 *   acompte         = achat × (1 + sécurité change) ÷ prix, arrondi au 5 %
 *                     supérieur, borné par les CGV (45 à 80 %)
 *
 * L'acompte couvre ainsi le paiement au fournisseur dès la signature, et le
 * solde couvre le fret, payé à l'arrivée à Tana : aucune moto n'engage de
 * capital. Le bénéfice croît avec le prix sans jamais sauter d'un palier à
 * l'autre — une moto plus chère à l'achat rapporte toujours plus.
 *
 * Ce module est importé par le formulaire du back-office, donc livré au
 * navigateur : il ne contient AUCUN chiffre. Les réglages par défaut vivent
 * dans `tarification-defaut.ts`, que seul le serveur importe.
 */
export type Reglages = {
  /** 1 ¥ = … Ar. */
  taux_yuan: number;
  /** Fret, dédouanement et papiers, fixe par moto (Ar). */
  fret_ar: number;
  /** Bénéfice minimum par moto (Ar). */
  benefice_fixe_ar: number;
  /** Part du prix d'achat ajoutée au bénéfice (%). */
  part_achat_pct: number;
  /** Marge de sécurité sur le change, pour l'acompte (%). */
  securite_change_pct: number;
  /** Palier d'arrondi du prix de vente (Ar). */
  arrondi_ar: number;
};

export type Calcul = {
  achat_ar: number;
  cout_ar: number;
  prix_ar: number;
  benefice_ar: number;
  acompte_pct: number;
  acompte_ar: number;
  solde_ar: number;
  /** Ce que l'acompte, plafonné par les CGV, ne couvre pas de l'achat (Ar). */
  capital_avance_ar: number;
  /** Le solde paie-t-il le fret à l'arrivée ? */
  solde_couvre_fret: boolean;
};

const arrondiSup = (n: number, pas: number) => Math.ceil(n / pas) * pas;

export function calculerPrix(prixYuan: number, r: Reglages): Calcul {
  const achat_ar = Math.round(prixYuan * r.taux_yuan);
  const cout_ar = achat_ar + r.fret_ar;
  const brut = cout_ar + r.benefice_fixe_ar + (achat_ar * r.part_achat_pct) / 100;
  const prix_ar = arrondiSup(Math.round(brut), Math.max(1, r.arrondi_ar));

  const aCouvrir = achat_ar * (1 + r.securite_change_pct / 100);
  // Epsilon : 0,55 × 20 vaut 11,000000000000002 en virgule flottante, et
  // l'arrondi supérieur passerait à tort au palier suivant.
  const requis = Math.ceil((aCouvrir / prix_ar) * 20 - 1e-9) * 5;
  const acompte_pct = Math.min(ACOMPTE_MAX, Math.max(ACOMPTE_MIN, requis));
  const acompte_ar = Math.round((prix_ar * acompte_pct) / 100);
  const solde_ar = prix_ar - acompte_ar;

  return {
    achat_ar,
    cout_ar,
    prix_ar,
    benefice_ar: prix_ar - cout_ar,
    acompte_pct,
    acompte_ar,
    solde_ar,
    capital_avance_ar: Math.max(0, achat_ar - acompte_ar),
    solde_couvre_fret: solde_ar >= r.fret_ar,
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
  if (!dans(r.fret_ar, 0, 100_000_000)) return "Fret et papiers invalides.";
  if (!dans(r.benefice_fixe_ar, 0, 100_000_000)) return "Bénéfice fixe invalide.";
  if (!dans(r.part_achat_pct, 0, 100)) return "Part du prix d'achat invalide : entre 0 et 100 %.";
  if (!dans(r.securite_change_pct, 0, 50)) return "Sécurité sur le change invalide : entre 0 et 50 %.";
  if (!dans(r.arrondi_ar, 1, 1_000_000)) return "Palier d'arrondi invalide.";
  return null;
}
