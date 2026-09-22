/**
 * Conditions commerciales citées à plusieurs endroits du site (CGV, FAQ,
 * fiche, « Comment ça marche »). Une seule source : une borne modifiée ici se
 * retrouve partout, sans risque de laisser une page contredire les CGV.
 *
 * Moto « disponible sur commande » : acompte à la signature du bon de
 * commande, propre à chaque véhicule (voir `lib/tarification.ts`), solde à la
 * retrait du véhicule, à Antananarivo.
 *
 * Les bornes sont écrites dans les CGV (art. 4.2) : elles ne se règlent pas
 * depuis le back-office, parce qu'en changer revient à changer le contrat.
 */
export const ACOMPTE_MIN = 45;
export const ACOMPTE_MAX = 80;

/** « 45 à 80 % », avec l'espace insécable de la typographie française. */
export const FOURCHETTE_ACOMPTE_TEXTE = `${ACOMPTE_MIN} à ${ACOMPTE_MAX} %`;

export const pourcent = (n: number) => `${n} %`;

/** Montant de l'acompte en ariary, arrondi à l'ariary. Le solde est le reste. */
export const montantAcompte = (prix: number, acomptePct: number) => Math.round((prix * acomptePct) / 100);

/**
 * Délai d'importation. Chaque fiche porte sa propre fourchette
 * (`delai_min_jours` / `delai_max_jours`) parce qu'elle dépend de la ligne
 * maritime empruntée ; ces deux bornes sont les valeurs par défaut et, pour le
 * maximum, le plafond que les CGV (art. 9) interdisent de dépasser.
 *
 * Écrit ici et nulle part ailleurs : une page qui promettrait un délai plus
 * court que le contrat serait une promesse que le contrat ne tient pas.
 */
export const DELAI_MIN = 45;
export const DELAI_MAX = 75;

/** « 45 à 75 jours », tel que l'affichent les cartes, les fiches et les métadonnées. */
export const FOURCHETTE_DELAI_TEXTE = `${DELAI_MIN} à ${DELAI_MAX} jours`;

/**
 * Retrait du véhicule après son arrivée à Antananarivo (CGV art. 11).
 *
 * L'escalier : retrait libre pendant `RETRAIT_JOURS`, puis des frais de
 * gardiennage journaliers pendant `GARDIENNAGE_PLAFOND_JOURS`, puis résolution
 * de plein droit. Le plafond et la résolution tombent le même jour — sans quoi,
 * passé le plafond, la moto resterait au local sans compteur ni sortie.
 */
export const RETRAIT_JOURS = 20;
export const GARDIENNAGE_AR_JOUR = 100_000;
export const GARDIENNAGE_PLAFOND_JOURS = 10;

/** Jour de la résolution de plein droit, compté depuis l'arrivée à Antananarivo. */
export const RESOLUTION_JOURS = RETRAIT_JOURS + GARDIENNAGE_PLAFOND_JOURS;

/** Indemnité forfaitaire conservée à la résolution, en plus du gardiennage échu. */
export const INDEMNITE_RESOLUTION_PCT = 15;

/** Grâce laissée à MOTO IMPORT au-delà du délai maximum avant annulation par l'acheteur. */
export const GRACE_LIVRAISON_JOURS = 15;
