-- MOTO IMPORT — journal des publications de la page Facebook. INFORMATION INTERNE.
--
-- Le Studio Facebook du back-office (/admin/facebook) y consigne chaque album :
-- publié par l'API, programmé, ou publié à la main après téléchargement du kit.
-- Il sert à trois choses : ne pas republier les mêmes motos (filtre « jamais
-- publiée »), retrouver les posts où une moto vendue apparaît pour y laisser
-- le commentaire « VENDUE », et compter les passages de chaque moto.
--
-- Les motos sont désignées par référence (MI-xxx) et non par clé étrangère :
-- une fiche supprimée puis recréée par import garde sa référence, et le
-- journal doit rester lisible même quand la fiche a disparu.
--
-- Prérequis : migration 0012 appliquée. Aucune politique : seule la clé de
-- service du serveur lit et écrit cette table, le public n'y a aucun accès.

create table if not exists publications_fb (
  id               uuid primary key default gen_random_uuid(),
  mode             text not null check (mode in ('direct', 'programme', 'manuel')),
  post_id          text,
  lien_post        text,
  programme_pour   timestamptz,
  titre            text not null default '',
  message          text not null default '',
  refs             text[] not null default '{}',
  ventes_signalees text[] not null default '{}',
  auteur           text,
  created_at       timestamptz not null default now()
);

create index if not exists publications_fb_date_idx on publications_fb (created_at desc);

alter table publications_fb enable row level security;
