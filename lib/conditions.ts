/**
 * Conditions commerciales citées à plusieurs endroits du site (CGV, FAQ,
 * fiche, « Comment ça marche »). Une seule source : une borne modifiée ici se
 * retrouve partout, sans risque de laisser une page contredire les CGV.
 *
 * Moto « disponible sur commande » : acompte à la signature du bon de
 * commande, propre à chaque véhicule (voir `lib/tarification.ts`), solde à la
 * remise des clés et des papiers, à Antananarivo.
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
