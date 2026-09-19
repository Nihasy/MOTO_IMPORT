-- MOTO IMPORT — tarification dynamique. INFORMATION INTERNE.
--
-- Le prix de vente ne se saisit plus : il se calcule à partir du prix d'achat
-- en yuan et de réglages (taux, fret, bénéfice) — voir lib/tarification.ts.
-- Le prix d'achat, le taux et les réglages ne doivent jamais sortir vers le
-- public. Trois barrières, cumulatives :
--   1. la vue publique ne les contient pas ;
--   2. le rôle public ne peut lire, sur la table motos, qu'une liste explicite
--      de colonnes (ci-dessous) ;
--   3. les réglages vivent dans une table sans aucune politique d'accès, que
--      seule la clé de service du back-office peut lire.
--
-- Prérequis : migration 0008 appliquée.

-- 1. Colonnes de la moto ----------------------------------------------------

alter table motos add column if not exists prix_yuan   integer check (prix_yuan > 0);
alter table motos add column if not exists taux_yuan   numeric(10, 2) check (taux_yuan > 0);
alter table motos add column if not exists acompte_pct smallint check (acompte_pct between 0 and 100);

-- Le prix est calculé : il vaut zéro tant que le prix d'achat manque. Seule une
-- fiche hors ligne peut rester à zéro.
alter table motos drop constraint if exists motos_prix_ttc_check;
alter table motos add constraint motos_prix_ttc_check
  check (prix_ttc > 0 or (prix_ttc = 0 and statut in ('brouillon', 'archive')));

-- 2. Vue publique : l'acompte en plus, rien d'interne -----------------------
-- `create or replace` n'autorise l'ajout qu'en fin de liste : l'acompte y va.

create or replace view motos_publiques
with (security_invoker = on) as
select
  id, reference, slug, marque, modele, annee, cylindree, categorie,
  etat, statut, kilometrage, couleur, puissance_ch, poids_kg,
  hauteur_selle_mm, refroidissement, transmission, abs, prix_ttc,
  prix_valable_jusqu_au, delai_min_jours, delai_max_jours, garantie_mois,
  garantie_texte, description, points_forts, etat_details, date_photos,
  date_vente, vues, created_at, updated_at, acompte_pct
from motos
where statut not in ('archive', 'brouillon');

-- 3. Lecture par colonnes ---------------------------------------------------
-- Supabase accorde par défaut la lecture de TOUTE la table au rôle public ;
-- retirer une seule colonne (comme 0002 le faisait pour fournisseur_id) ne
-- suffit pas tant que ce droit global existe. On le retire, puis on accorde
-- les seules colonnes publiques. fournisseur_id, prix_yuan et taux_yuan en
-- sont absents.

revoke select on motos from anon, authenticated;
grant select (
  id, reference, slug, marque, modele, annee, cylindree, categorie,
  etat, statut, kilometrage, couleur, puissance_ch, poids_kg,
  hauteur_selle_mm, refroidissement, transmission, abs, prix_ttc,
  prix_valable_jusqu_au, delai_min_jours, delai_max_jours, garantie_mois,
  garantie_texte, description, points_forts, etat_details, date_photos,
  date_vente, vues, created_at, updated_at, acompte_pct
) on motos to anon, authenticated;

-- 4. Réglages de tarification -------------------------------------------------
-- Aucune politique : RLS activée sans règle = aucun accès, sauf la clé de
-- service. Aucune ligne n'est insérée : sans elle, le back-office applique les
-- réglages par défaut (670 Ar, 5 000 000 Ar, 2 000 000 Ar + 10 %).

create table if not exists tarification (
  id          smallint primary key default 1 check (id = 1),
  reglages    jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table tarification enable row level security;
revoke all on tarification from anon, authenticated;
