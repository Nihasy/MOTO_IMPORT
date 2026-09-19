/**
 * Conditions commerciales citées à plusieurs endroits du site (CGV, FAQ,
 * fiche, « Comment ça marche »). Une seule source : un pourcentage modifié ici
 * se retrouve partout, sans risque de laisser une page contredire les CGV.
 *
 * Moto « disponible sur commande » : acompte à la signature du bon de
 * commande, solde à la remise des clés et des papiers, à Antananarivo.
 */

/** Acompte versé à la signature du bon de commande. */
export const ACOMPTE_COMMANDE = 70;

/** Solde réglé à la remise des clés et des papiers. */
export const SOLDE_LIVRAISON = 100 - ACOMPTE_COMMANDE;

/** « 70 % », avec l'espace insécable de la typographie française. */
export const ACOMPTE_COMMANDE_TEXTE = `${ACOMPTE_COMMANDE} %`;
export const SOLDE_LIVRAISON_TEXTE = `${SOLDE_LIVRAISON} %`;
