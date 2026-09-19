-- MOTO IMPORT — coordonnées du local modifiables depuis le back-office.
--
-- Adresse, horaires, numéro WhatsApp et téléphone vivaient dans le code ou en
-- variables d'environnement `NEXT_PUBLIC_*`, figées à la construction : changer
-- un horaire imposait un redéploiement. Une ligne unique suffit (id = 1).
--
-- Tant que cette migration n'est pas appliquée, le site affiche les valeurs par
-- défaut de `lib/parametres.ts` : rien ne casse, rien n'est modifiable.

create table if not exists parametres (
  id          smallint primary key default 1 check (id = 1),
  adresse     text not null,
  horaires    jsonb not null default '[]'::jsonb,
  whatsapp    text not null check (whatsapp ~ '^[0-9]{8,15}$'),
  telephone   text not null,
  updated_at  timestamptz not null default now()
);

-- Des coordonnées publiques par nature : lecture ouverte. L'écriture passe par
-- la clé de service du back-office, qui contourne la RLS ; aucune politique
-- d'écriture n'est donc ouverte ici.
alter table parametres enable row level security;

drop policy if exists parametres_lecture_publique on parametres;
create policy parametres_lecture_publique on parametres
  for select using (true);

-- Aucune ligne n'est insérée : sans elle, le site garde les valeurs actuelles
-- (numéro WhatsApp de la variable NEXT_PUBLIC_WHATSAPP_NUMBER compris). Le
-- premier enregistrement depuis le back-office crée la ligne.
