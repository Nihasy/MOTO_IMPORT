-- MOTO IMPORT — statut « brouillon ».
--
-- Le chapitre 10.3 énumère des contrôles « bloquants » avant publication, mais
-- l'énumération ne comportait aucun état antérieur à la publication : une fiche
-- naissait « disponible », donc publique, donc en vente avec zéro photo. Le
-- verrou du chapitre 7.1 n'avait littéralement pas d'état où retenir la fiche.
--
-- `brouillon` est cet état. Il est interne au même titre qu'`archive`, mais il
-- ne dit pas la même chose : `archive` est réservé aux fiches erronées (13.1),
-- `brouillon` à celles qui sont en cours de préparation. Les confondre ferait
-- perdre la distinction au moment du ménage.
--
-- La valeur est ajoutée seule : PostgreSQL interdit d'utiliser une valeur
-- d'énumération dans la même transaction que son ajout. La vue publique et la
-- politique RLS sont donc reprises dans la migration 0007.

alter type moto_statut add value if not exists 'brouillon' before 'dispo_immediate';
