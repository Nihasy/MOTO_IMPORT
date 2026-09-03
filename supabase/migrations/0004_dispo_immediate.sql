-- Statut « Disponible de suite » : moto déjà à Antananarivo, livrable sans
-- attendre les 45 à 65 jours d'importation. Elle se vend sur ce seul argument,
-- d'où un statut à part plutôt qu'un simple drapeau.
--
-- `add value` sur un type enum ne peut pas tourner dans un bloc transactionnel
-- sur les versions antérieures à PostgreSQL 12 ; Supabase est bien au-delà,
-- mais `if not exists` garde la migration rejouable sans erreur.
alter type moto_statut add value if not exists 'dispo_immediate' before 'disponible';

-- L'index public filtre sur « pas archivé » : il couvre le nouveau statut sans
-- modification. Les contraintes liées à la vente ne concernent que 'vendu'.
