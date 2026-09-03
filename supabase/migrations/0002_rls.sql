-- MOTO IMPORT — Row Level Security et protection des fournisseurs
-- Chapitre 12 du cahier des charges.

-- 12.1 RLS activée sur toutes les tables, sans exception -------------------

alter table motos        enable row level security;
alter table medias       enable row level security;
alter table demandes     enable row level security;
alter table fournisseurs enable row level security;
alter table import_lots  enable row level security;

-- Motos : lecture publique limitée aux fiches non archivées.
create policy motos_lecture_publique on motos
  for select using (statut <> 'archive');

create policy motos_ecriture_authentifiee on motos
  for all to authenticated using (true) with check (true);

-- Médias : visibles si la moto rattachée l'est.
create policy medias_lecture_publique on medias
  for select using (
    exists (select 1 from motos m where m.id = moto_id and m.statut <> 'archive')
  );

create policy medias_ecriture_authentifiee on medias
  for all to authenticated using (true) with check (true);

-- Fournisseurs : aucun accès anonyme, ni en lecture ni en écriture.
create policy fournisseurs_authentifie on fournisseurs
  for all to authenticated using (true) with check (true);

-- Demandes : création anonyme, lecture réservée.
create policy demandes_creation on demandes
  for insert with check (true);

create policy demandes_lecture on demandes
  for select to authenticated using (true);

create policy demandes_maj on demandes
  for update to authenticated using (true) with check (true);

-- Lots d'import : strictement interne.
create policy import_lots_authentifie on import_lots
  for all to authenticated using (true) with check (true);

-- 12.2 Vue publique sans fournisseur_id ------------------------------------
-- Première des deux mesures cumulatives : la colonne ne peut pas sortir,
-- même en cas d'oubli d'un `select` explicite côté application.

create view motos_publiques
with (security_invoker = on) as
select
  id, reference, slug, marque, modele, annee, cylindree, categorie,
  etat, statut, kilometrage, couleur, puissance_ch, poids_kg,
  hauteur_selle_mm, refroidissement, transmission, abs, prix_ttc,
  prix_valable_jusqu_au, delai_min_jours, delai_max_jours, garantie_mois,
  garantie_texte, description, points_forts, etat_details, date_photos,
  date_vente, vues, created_at, updated_at
from motos
where statut <> 'archive';

comment on view motos_publiques is
  'Vue exposee au public. fournisseur_id en est volontairement absent (CDC 12.2).';

grant select on motos_publiques to anon, authenticated;

-- Retrait explicite du droit de lecture directe de la colonne sensible.
revoke select (fournisseur_id) on motos from anon;
