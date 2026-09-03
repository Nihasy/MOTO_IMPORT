-- MOTO IMPORT — schéma initial
-- Chapitre 6 du cahier des charges.

create extension if not exists "pgcrypto";

-- 6.1 Types énumérés -------------------------------------------------------

create type moto_etat        as enum ('neuf', 'occasion');
create type moto_statut      as enum ('disponible', 'reserve', 'vendu', 'archive');
create type moto_categorie   as enum ('sportive', 'trail', 'roadster', 'motocross', 'custom');
create type media_type       as enum ('photo', 'video');
create type media_origine    as enum ('reelle', 'constructeur');
create type vue_photo        as enum (
  '34_avant_droit', 'profil_droit', '34_arriere_gauche', 'face_avant',
  'compteur', 'moteur', 'pneu_avant', 'pneu_arriere', 'selle',
  'chassis', 'echappement', 'defaut', 'autre'
);
create type demande_statut   as enum ('nouveau','contacte','rdv_fixe','contrat_signe','perdu');
create type demande_source   as enum ('facebook','instagram','tiktok','google','direct','bouche_a_oreille');

-- 6.5 Fournisseurs (créée en premier : référencée par motos) ---------------

create table fournisseurs (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,
  contact      text,
  ville_chine  text,
  specialite   text,
  notes        text,
  created_at   timestamptz not null default now()
);

create unique index fournisseurs_nom_idx on fournisseurs (lower(nom));

-- 6.2 Motos ----------------------------------------------------------------

create table motos (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  slug                  text not null unique,
  marque                text not null,
  modele                text not null,
  annee                 int  not null check (annee between 1990 and 2100),
  cylindree             int  not null check (cylindree > 0),
  categorie             moto_categorie not null,
  etat                  moto_etat not null,
  statut                moto_statut not null default 'disponible',

  kilometrage           int check (kilometrage >= 0),
  couleur               text,
  puissance_ch          int,
  poids_kg              int,
  hauteur_selle_mm      int,
  refroidissement       text check (refroidissement in ('air','liquide')),
  transmission          text,
  abs                   boolean not null default false,

  prix_ttc              bigint not null check (prix_ttc > 0),
  prix_valable_jusqu_au date not null,
  delai_min_jours       int not null default 45,
  delai_max_jours       int not null default 65,

  garantie_mois         int not null default 0,
  garantie_texte        text,

  description           text not null,
  points_forts          text[] not null default '{}',
  etat_details          jsonb,
  date_photos           date,

  fournisseur_id        uuid references fournisseurs(id) on delete set null,
  date_vente            date,
  vues                  int not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Contraintes métier issues des CGV
  constraint km_si_occasion            check (etat = 'neuf' or kilometrage is not null),
  constraint photos_datees_si_occasion check (etat = 'neuf' or date_photos is not null),
  constraint date_vente_si_vendu       check (statut <> 'vendu' or date_vente is not null),
  constraint delais_coherents          check (delai_max_jours >= delai_min_jours)
);

create index motos_public_idx  on motos (statut, prix_ttc) where statut <> 'archive';
create index motos_filtres_idx on motos (categorie, etat, cylindree, prix_ttc);
create index motos_recherche_idx on motos
  using gin (to_tsvector('french', marque || ' ' || modele));

-- 6.6 Lots d'import (créée avant medias : référencée par lot_id) ----------

create table import_lots (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('motos_csv','medias_masse')),
  fichier_nom  text,
  total        int not null default 0,
  reussis      int not null default 0,
  echoues      int not null default 0,
  rapport      jsonb,
  auteur_id    uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 6.3 Médias ---------------------------------------------------------------

create table medias (
  id            uuid primary key default gen_random_uuid(),
  moto_id       uuid not null references motos(id) on delete cascade,
  type          media_type not null default 'photo',
  origine       media_origine not null default 'reelle',
  vue           vue_photo not null default 'autre',

  cloudinary_id text not null,
  largeur       int not null,
  hauteur       int not null,
  blurhash      text,

  ordre         int not null,
  legende       text,
  alt           text not null,
  date_prise    date,

  lot_id        uuid references import_lots(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (moto_id, ordre)
);

create index medias_moto_idx on medias (moto_id, ordre);
create index medias_lot_idx  on medias (lot_id);

-- 6.4 Demandes -------------------------------------------------------------

create table demandes (
  id          uuid primary key default gen_random_uuid(),
  moto_id     uuid references motos(id) on delete set null,
  reference   text,
  nom         text,
  telephone   text,
  budget_max  bigint,
  message     text,
  source      demande_source not null default 'direct',
  statut      demande_statut not null default 'nouveau',
  notes       text,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index demandes_statut_idx on demandes (statut, created_at desc);
create index demandes_source_idx on demandes (source, created_at desc);

-- Horodatage automatique ---------------------------------------------------

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger motos_touch    before update on motos    for each row execute function touch_updated_at();
create trigger demandes_touch before update on demandes for each row execute function touch_updated_at();

-- Date de vente renseignée automatiquement au passage en `vendu` (10.2) ----

create or replace function synchroniser_date_vente() returns trigger
language plpgsql as $$
begin
  if new.statut = 'vendu' and new.date_vente is null then
    new.date_vente = current_date;
  elsif new.statut <> 'vendu' then
    new.date_vente = null;
  end if;
  return new;
end;
$$;

create trigger motos_date_vente before insert or update of statut on motos
  for each row execute function synchroniser_date_vente();

-- Compteur de vues ---------------------------------------------------------

create or replace function incrementer_vues(moto uuid) returns void
language sql security definer set search_path = public as $$
  update motos set vues = vues + 1 where id = moto;
$$;
