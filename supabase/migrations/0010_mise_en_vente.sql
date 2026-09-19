-- MOTO IMPORT — mise en vente prévue d'une fiche.
--
-- Une fiche naît en brouillon (saisie ou import CSV) et passe en vente plus
-- tard, souvent par la publication en masse. Il faut donc savoir, dès la
-- saisie, sous quel statut elle partira :
--   commande : « Disponible sur commande », importée après signature ;
--   local    : « Disponible de suite », déjà au local d'Antananarivo.
-- Sans cette colonne, une moto déjà à Tana partait « sur commande », avec un
-- acompte et un délai de 45 à 65 jours qui ne la concernent pas.
--
-- Prérequis : migration 0009 appliquée. Colonne interne, hors de la liste des
-- colonnes lisibles par le public (0009) : le statut public suffit.

alter table motos add column if not exists mise_en_vente text not null default 'commande'
  check (mise_en_vente in ('commande', 'local'));

-- Les fiches déjà « disponibles de suite » sont, par définition, au local.
update motos set mise_en_vente = 'local' where statut = 'dispo_immediate';
