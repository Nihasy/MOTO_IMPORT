-- MOTO IMPORT — le brouillon ne sort jamais du back-office.
--
-- Suite de 0006, dans une migration distincte parce qu'une valeur d'énumération
-- ne peut pas être utilisée dans la transaction qui l'ajoute.
--
-- Trois surfaces à fermer, et il faut les fermer toutes : la politique RLS
-- (lecture directe avec la clé anonyme), la vue publique (lecture applicative)
-- et l'index partiel (cohérence). Une seule oubliée suffit à publier une fiche
-- que le back-office croit retenue.

-- 1. Lecture publique : ni archivé, ni brouillon.
drop policy if exists motos_lecture_publique on motos;
create policy motos_lecture_publique on motos
  for select using (statut not in ('archive', 'brouillon'));

drop policy if exists medias_lecture_publique on medias;
create policy medias_lecture_publique on medias
  for select using (
    exists (
      select 1 from motos m
       where m.id = moto_id
         and m.statut not in ('archive', 'brouillon')
    )
  );

-- 2. Vue publique : même filtre, mêmes colonnes, fournisseur_id toujours absent.
drop view if exists motos_publiques;

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
where statut not in ('archive', 'brouillon');

comment on view motos_publiques is
  'Vue exposee au public. fournisseur_id en est volontairement absent (CDC 12.2), '
  'et les fiches en brouillon ou archivees en sont exclues.';

grant select on motos_publiques to anon, authenticated;

-- 3. Index partiel aligné sur le nouveau filtre.
drop index if exists motos_public_idx;
create index motos_public_idx on motos (statut, prix_ttc)
  where statut not in ('archive', 'brouillon');
