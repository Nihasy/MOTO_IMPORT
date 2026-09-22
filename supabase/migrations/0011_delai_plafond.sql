-- MOTO IMPORT — délai d'importation porté à 45-75 jours et plafonné.
--
-- Le délai dépend de la compagnie maritime et de la ligne empruntée : la
-- fréquence des départs, le port de transbordement et la durée de traversée
-- changent d'un transporteur à l'autre. Annoncer 65 jours et livrer au 72e
-- coûtait plus cher qu'annoncer 75. Les CGV (art. 9.1) posent désormais un
-- plafond ferme, et l'acheteur peut annuler au-delà (art. 9.4).
--
-- La contrainte matérialise ce plafond en base, parce qu'une fiche qui
-- annoncerait davantage promettrait un délai que le contrat permet déjà de
-- refuser. Le minimum reste 45 jours : aucune ligne ne fait mieux.
--
-- Prérequis : migration 0010 appliquée.

alter table motos alter column delai_max_jours set default 75;

-- Les fiches en cours gardent le délai sur lequel leur acheteur s'est engagé :
-- seules les fiches non encore vendues suivent le nouveau plafond par défaut.
-- Rien n'est réécrit ici — chaque fiche porte sa propre fourchette.

alter table motos drop constraint if exists delai_sous_plafond;
alter table motos add constraint delai_sous_plafond check (delai_max_jours <= 75);
