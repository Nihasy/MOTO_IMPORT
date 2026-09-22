# CAHIER DES CHARGES — APPLICATION WEB MOTO IMPORT
**Passion & Prestige**
Document de référence unique · Version 2.0 · Prêt pour développement et mise en production

---

## SOMMAIRE

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Contexte et contraintes métier](#2-contexte-et-contraintes-métier)
3. [Objectifs et critères de succès](#3-objectifs-et-critères-de-succès)
4. [Utilisateurs et parcours](#4-utilisateurs-et-parcours)
5. [Architecture technique](#5-architecture-technique)
6. [Modèle de données](#6-modèle-de-données)
7. [Système de médias et upload en masse](#7-système-de-médias-et-upload-en-masse)
8. [Système de design](#8-système-de-design)
9. [Spécification des écrans publics](#9-spécification-des-écrans-publics)
10. [Back-office](#10-back-office)
11. [API et routes](#11-api-et-routes)
12. [Sécurité](#12-sécurité)
13. [SEO, performance, analytics](#13-seo-performance-analytics)
14. [Environnements et déploiement](#14-environnements-et-déploiement)
15. [Phasage et définition de terminé](#15-phasage-et-définition-de-terminé)
16. [Recette](#16-recette)
17. [Annexes](#17-annexes)

---

# 1. RÉSUMÉ EXÉCUTIF

## 1.1 Ce qu'est le produit

Une application web progressive, mobile d'abord, servant de **catalogue de motocycles importés** pour MOTO IMPORT (Antananarivo). Elle présente des véhicules neufs et d'occasion sourcés en Chine, affiche un prix final rendu à Tana carte grise incluse, et convertit le visiteur en conversation WhatsApp qualifiée.

## 1.2 Ce qu'elle n'est pas

**Ce n'est pas une boutique en ligne.** Ni panier, ni paiement, ni compte client en V1. C'est une décision structurante qui découle directement des CGV : la vente se conclut physiquement au local par signature d'un bon de commande et versement d'un acompte de 35 %.

Toute fonctionnalité e-commerce ajoutée en V1 contredirait le contrat et allongerait le délai de livraison sans gain commercial.

## 1.3 Les trois piliers fonctionnels

| Pilier | Enjeu |
|---|---|
| **Catalogue filtrable** | Le visiteur trouve une moto qui correspond à sa cylindrée ou à son budget |
| **Fiche produit dense en photos** | Le visiteur voit assez pour décider sans se déplacer |
| **Back-office à publication rapide** | Le catalogue reste à jour, y compris depuis un téléphone |

Le troisième pilier est le plus souvent négligé et le plus déterminant : un catalogue périmé détruit la confiance plus vite qu'un catalogue vide.

## 1.4 Utilisateurs du back-office

Deux comptes, deux cofondateurs :
- **Nihasy** — sourcing, logistique, prix, contrats. Administrateur.
- **Sa sœur** — expertise moto, contenu, relation client. Éditrice.

---

# 2. CONTEXTE ET CONTRAINTES MÉTIER

## 2.1 Règles issues des CGV — non négociables dans le produit

Ces règles doivent être visibles dans l'interface, pas seulement dans le document juridique.

| Règle CGV | Traduction produit |
|---|---|
| Aucun stock, commande sur mesure | Statut `disponible` signifie « sourçable », jamais « en stock » |
| Acompte 35 % à la signature | Affiché sur chaque fiche et dans « Comment ça se passe » |
| Délai 45 à 75 jours | Affiché sur chaque fiche et sur les cartes du catalogue ; varie selon la compagnie maritime, plafonné par les CGV art. 9.1 |
| Retrait sous 20 jours | Compté depuis l'arrivée à Tana ; gardiennage 100 000 Ar/jour plafonné à 10 jours, puis résolution (CGV art. 11) |
| Prix rendu Tana, carte grise incluse | Sous le prix, systématiquement, sans exception |
| Prix valable jusqu'à une date | Champ `prix_valable_jusqu_au`, alerte back-office à échéance |
| Désistement : acompte acquis | Page FAQ dédiée, liée depuis chaque fiche |
| Neuf et occasion | Le champ `etat` pilote l'affichage complet de la fiche |
| Occasion : photos datées, points d'usure | Bloc « État du véhicule » obligatoire, photos horodatées |

## 2.2 Contraintes d'exploitation

- **Équipe : deux personnes**, dont un étudiant en informatique. L'outil doit être maintenable seul.
- **Budget infrastructure : environ 80 000 Ar/an.** Offres gratuites Vercel, Supabase, Cloudinary.
- **Publication depuis un téléphone** obligatoire pour les actions courantes (changer un statut, un prix).
- **Trois fournisseurs chinois** livrant des lots de photos volumineux et mal nommés. D'où le chapitre 7.

## 2.3 Ce qui n'est pas une contrainte

La consommation de données du visiteur n'est pas un critère de conception retenu. Les galeries riches sont assumées. La performance reste néanmoins un objectif, mais pour le confort et le référencement, pas pour l'économie de mégaoctets.

---

# 3. OBJECTIFS ET CRITÈRES DE SUCCÈS

| Indicateur | Mesure | Cible à 3 mois |
|---|---|---|
| Taux de clic vers WhatsApp | clics devis / visiteurs uniques | ≥ 6 % |
| Demandes qualifiées | entrées en table `demandes` | ≥ 15/semaine |
| Conversion demande → RDV | suivi back-office | ≥ 40 % |
| Contrats signés | statut `contrat_signe` | ≥ 3/mois |
| Temps sur fiche produit | analytics | ≥ 90 s |
| Délai de publication d'une moto | chronomètre réel | ≤ 5 min depuis un téléphone |
| Fiches au plan de prise de vue complet | back-office, filtre « Incomplètes » | 100 % des fiches en ligne |

**Le seul indicateur qui décide de l'avenir du projet est le nombre de contrats signés attribués au site.** Le champ `source` de la table `demandes` doit permettre de le calculer sans ambiguïté.

---

# 4. UTILISATEURS ET PARCOURS

## 4.1 Personas

**Le motard confirmé — cible principale.** 28-45 ans, possède déjà une moto, cherche une cylindrée précise. Il arrive avec une intention et compare les prix. Il veut : fiche technique complète, photos réelles nombreuses, prix tout compris, preuve que ce n'est pas une arnaque.

**Le premier acheteur urbain — cible secondaire.** 24-35 ans, ne sait pas quoi choisir, arrive avec un budget. Sa question est « qu'est-ce que je peux avoir pour 12 millions ? ».

**Conséquence produit :** deux portes d'entrée obligatoires — par catégorie/cylindrée, et par budget.

## 4.2 Parcours principal

```
Facebook / TikTok / Instagram
        ↓
  Fiche moto (arrivée directe via lien partagé)
        ↓
  Galerie · prix · délai · carte grise → compris en 15 secondes
        ↓
  « Demander le devis » → WhatsApp pré-rempli avec la référence
        ↓
  Conversation → RDV au local
        ↓
  Bon de commande signé + acompte 35 %
```

**Environ 80 % du trafic arrive directement sur une fiche produit, pas sur l'accueil.** Chaque fiche doit donc être autoportante : vendre la moto *et* l'entreprise. C'est la contrainte de conception la plus importante du projet.

## 4.3 Parcours secondaires

- Navigation par budget depuis la feuille de filtres
- Consultation des motos enregistrées avant décision
- Retour sur une fiche vendue → « Trouvez-moi la même »
- Recherche textuelle par marque ou modèle

---

# 5. ARCHITECTURE TECHNIQUE

## 5.1 Stack

| Brique | Choix | Version | Justification |
|---|---|---|---|
| Framework | Next.js, App Router | 15.x | Rendu serveur pour le SEO et les partages sociaux |
| Langage | TypeScript | 5.x | Strict mode activé |
| Base de données | Supabase (PostgreSQL) | 15 | Offre gratuite suffisante, RLS native |
| Authentification | Supabase Auth | — | Deux comptes back-office |
| Stockage médias | Cloudinary | — | Dérivés automatiques, transformations à la volée |
| Style | Tailwind CSS | 3.x | |
| Composants | Radix UI (primitives) | — | Feuilles inférieures, dialogues accessibles |
| Formulaires | React Hook Form + Zod | — | Validation partagée client/serveur |
| Hébergement | Vercel | — | Déploiement par push, offre gratuite |
| Monitoring | Sentry | — | Offre gratuite |

**Pourquoi pas Medusa** malgré l'expérience acquise sur Z-SHOP : Medusa est une infrastructure e-commerce avec panier, paiement, stock et gestion de commandes. Aucune de ces briques n'est utilisée ici. La complexité serait entièrement gratuite.

## 5.2 Arborescence du code

```
/app
  /(public)
    page.tsx                    Accueil
    /motos
      page.tsx                  Catalogue
      /[slug]/page.tsx          Fiche produit
    /comment-ca-marche/page.tsx
    /faq/page.tsx
    /contact/page.tsx
    /cgv/page.tsx
    /mentions-legales/page.tsx
  /admin
    layout.tsx                  Garde d'authentification
    page.tsx                    Tableau de bord
    /motos
      page.tsx                  Liste + bascule de statut
      /nouvelle/page.tsx
      /[id]/page.tsx            Édition + médias
    /import
      page.tsx                  Import CSV + upload en masse
    /demandes/page.tsx          CRM
    /fournisseurs/page.tsx
  /api
    /demandes/route.ts
    /upload/signature/route.ts
    /import/motos/route.ts
    /import/medias/route.ts
    /revalidate/route.ts
  sitemap.ts
  robots.ts
  opengraph-image.tsx
/components
  /ui                           Primitives du design system
  /catalogue                    Carte, galerie, filtres
  /fiche                        Galerie plein écran, specs, état
  /admin                        Tableaux, uploader, file d'attente
/lib
  supabase/                     Clients serveur et navigateur
  cloudinary.ts
  schemas.ts                    Schémas Zod partagés
  format.ts                     Formatage Ariary, dates, slug
  whatsapp.ts                   Construction des liens pré-remplis
/supabase
  /migrations                   SQL versionné
```

## 5.3 Stratégie de rendu

| Route | Rendu | Revalidation |
|---|---|---|
| `/` | Statique | 1 h + à la demande |
| `/motos` | Serveur dynamique | Filtres dans l'URL |
| `/motos/[slug]` | Statique généré | À la demande sur modification |
| Pages éditoriales | Statique | Au déploiement |
| `/admin/*` | Dynamique, sans cache | — |

Toute modification en back-office déclenche `revalidatePath` sur la fiche concernée et sur `/motos`.

---

# 6. MODÈLE DE DONNÉES

## 6.1 Types énumérés

```sql
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
```

## 6.2 Table `motos`

```sql
create table motos (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,          -- MI-047
  slug                  text not null unique,
  marque                text not null,
  modele                text not null,
  annee                 int  not null check (annee between 1990 and 2100),
  cylindree             int  not null check (cylindree > 0),
  categorie             moto_categorie not null,
  etat                  moto_etat not null,
  statut                moto_statut not null default 'disponible',

  kilometrage           int check (kilometrage >= 0),   -- requis si occasion
  couleur               text,
  puissance_ch          int,
  poids_kg              int,
  hauteur_selle_mm      int,
  refroidissement       text check (refroidissement in ('air','liquide')),
  transmission          text,
  abs                   boolean default false,

  prix_ttc              bigint not null check (prix_ttc > 0),   -- Ariary
  prix_valable_jusqu_au date not null,
  delai_min_jours       int not null default 45,
  delai_max_jours       int not null default 75,   -- plafond CGV art. 9.1

  garantie_mois         int not null default 0,
  garantie_texte        text,

  description           text not null,
  points_forts          text[] not null default '{}',
  etat_details          jsonb,          -- occasion : points d'usure structurés
  date_photos           date,           -- occasion : date de prise de vue

  fournisseur_id        uuid references fournisseurs(id),  -- JAMAIS exposé
  date_vente            date,
  vues                  int not null default 0,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index motos_public_idx on motos (statut, prix_ttc)
  where statut <> 'archive';
create index motos_filtres_idx on motos (categorie, etat, cylindree, prix_ttc);
create index motos_recherche_idx on motos
  using gin (to_tsvector('french', marque || ' ' || modele));
```

**Contraintes métier à implémenter en trigger :**

```sql
-- Kilométrage obligatoire pour l'occasion
alter table motos add constraint km_si_occasion
  check (etat = 'neuf' or kilometrage is not null);

-- Date de photos obligatoire pour l'occasion (exigence CGV art. 3.4)
alter table motos add constraint photos_datees_si_occasion
  check (etat = 'neuf' or date_photos is not null);

-- Date de vente renseignée quand vendu
alter table motos add constraint date_vente_si_vendu
  check (statut <> 'vendu' or date_vente is not null);
```

## 6.3 Table `medias`

```sql
create table medias (
  id            uuid primary key default gen_random_uuid(),
  moto_id       uuid not null references motos(id) on delete cascade,
  type          media_type not null default 'photo',
  origine       media_origine not null default 'reelle',
  vue           vue_photo not null default 'autre',

  cloudinary_id text not null,
  largeur       int not null,
  hauteur       int not null,
  blurhash      text,                    -- aperçu instantané

  ordre         int not null,
  legende       text,
  alt           text not null,
  date_prise    date,

  created_at    timestamptz not null default now(),
  unique (moto_id, ordre)
);

create index medias_moto_idx on medias (moto_id, ordre);
```

Le champ **`origine`** est le plus important de cette table. Il distingue une photo du véhicule réel d'un visuel constructeur fourni par le fournisseur chinois. Il pilote l'affichage du badge « Photos réelles », qui est votre principal argument de confiance face aux pages concurrentes qui recyclent des images d'Alibaba sans le dire.

## 6.4 Table `demandes`

```sql
create table demandes (
  id          uuid primary key default gen_random_uuid(),
  moto_id     uuid references motos(id) on delete set null,
  reference   text,                      -- conservée si la moto est supprimée
  nom         text,
  telephone   text,
  budget_max  bigint,
  message     text,
  source      demande_source not null default 'direct',
  statut      demande_statut not null default 'nouveau',
  notes       text,
  ip_hash     text,                      -- anti-abus, jamais l'IP en clair
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

Cette table est votre CRM et votre outil d'arbitrage publicitaire. Sans elle, vous ne saurez jamais quel réseau social produit réellement des contrats.

## 6.5 Table `fournisseurs`

```sql
create table fournisseurs (
  id           uuid primary key default gen_random_uuid(),
  nom          text not null,
  contact      text,
  ville_chine  text,
  specialite   text,
  notes        text,
  created_at   timestamptz not null default now()
);
```

**Table strictement interne.** Aucune route publique ne doit pouvoir la lire, directement ou par jointure. Vos trois fournisseurs sont un actif stratégique : une fuite dans une réponse JSON suffit à ce qu'un concurrent vous contourne. Voir chapitre 12.

## 6.6 Table `import_lots`

Traçabilité des imports en masse, indispensable pour annuler un lot mal formé.

```sql
create table import_lots (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('motos_csv','medias_masse')),
  fichier_nom  text,
  total        int not null default 0,
  reussis      int not null default 0,
  echoues      int not null default 0,
  rapport      jsonb,                    -- détail ligne par ligne
  auteur_id    uuid references auth.users(id),
  created_at   timestamptz not null default now()
);
```

---

# 7. SYSTÈME DE MÉDIAS ET UPLOAD EN MASSE

C'est le chapitre le plus important du document. Vous recevez des lots de photos de trois fournisseurs différents, mal nommés, en désordre. Sans système, la saisie manuelle devient le goulot d'étranglement qui tuera la mise à jour du catalogue.

## 7.1 Le plan de prise de vue — ordre imposé

Chaque moto est photographiée dans le **même ordre**, sans exception. Un ordre constant permet à l'acheteur de comparer deux motos vue par vue, et vous évite d'oublier un angle.

**L'ordre est la règle de travail ; seules trois vues conditionnent la mise en
vente** : 3/4 avant droit (la couverture), 3/4 arrière gauche et face avant —
la silhouette complète du véhicule. Les autres restent prévues, nommées et
affichées quand elles existent, mais leur absence ne retient plus la fiche en
brouillon : exiger le compteur, le moteur, les deux pneus et la selle bloquait
des motos présentables pour des clichés que les ateliers n'envoient pas toujours.

| # | Vue | Code | Exigée pour publier |
|---|---|---|---|---|
| 1 | 3/4 avant droit — **photo de couverture** | `34ad` | ✔ |
| 2 | Profil droit complet | `pd` | — |
| 3 | 3/4 arrière gauche | `34ag` | ✔ |
| 4 | Face avant | `fa` | ✔ |
| 5 | Compteur, kilométrage lisible | `cpt` | — |
| 6 | Moteur | `mot` | — |
| 7 | Pneu avant | `pav` | — |
| 8 | Pneu arrière | `par` | — |
| 9 | Selle et commandes | `sel` | — |
| 10 | Numéro de châssis | `cha` | — |
| 11+ | Gros plans des points d'usure | `def1`, `def2`… | — |

**Aucun seuil chiffré de photos.** Les lots reçus des trois ateliers partenaires comptent un nombre très variable de clichés, et un nombre ne dit rien de ce qui est montré : quinze photos du même profil valent moins que dix vues distinctes. Le back-office refuse la publication tant qu'une des trois **vues exigées** du tableau ci-dessus manque — le nombre total, lui, est libre. C'est l'absence d'angle, pas la maigreur du lot, qui réactive le doute que tout le reste du site cherche à dissiper.

## 7.2 Convention de nommage des fichiers

C'est le mécanisme central de l'import en masse.

```
{REFERENCE}_{ORDRE}_{CODE_VUE}[-cat].{ext}
```

Exemples :

```
MI-047_01_34ad.jpg          → moto MI-047, position 1, 3/4 avant droit, photo réelle
MI-047_05_cpt.jpg           → position 5, compteur, photo réelle
MI-047_11_def1.jpg          → position 11, point d'usure n°1
MI-051_01_34ad-cat.jpg      → visuel constructeur (origine = 'constructeur')
```

Le suffixe `-cat` bascule `origine` sur `constructeur`. Sans suffixe, la photo est considérée comme réelle.

**Pourquoi cette convention plutôt qu'une interface de tri manuel :** vous pouvez renommer 200 fichiers en trois minutes avec un renommage par lot sur votre ordinateur, puis tout déposer d'un coup. Trier 200 photos à la souris prend deux heures et se refait à chaque arrivage.

## 7.3 Écran d'import en masse des photos

**Route :** `/admin/import`

**Déroulé :**

1. **Dépôt.** Zone de glisser-déposer acceptant jusqu'à 300 fichiers, ou un `.zip`. Formats : JPG, PNG, WebP, HEIC.
2. **Analyse locale.** Le navigateur lit les noms de fichiers, extrait référence, ordre et code de vue.
3. **Écran de réconciliation.** Affichage groupé par référence :

```
┌──────────────────────────────────────────────┐
│ MI-047 · Honda CB500X          12 photos  ✔  Plan complet (occasion)
│ MI-051 · Yamaha MT-03           9 photos  ✔  Plan complet (neuf)
│ MI-058 · Honda Rebel 500        7 photos  ⚠  Manque compteur, châssis
│ MI-062 · référence inconnue     4 photos  ✖  Aucune moto à cette référence
│ 6 fichiers non conformes                  ✖  Nom illisible → assigner à la main
└──────────────────────────────────────────────┘
```

4. **Correction.** Les fichiers non reconnus sont assignables manuellement, par glisser-déposer sur une moto.
5. **Compression côté navigateur.** Avant tout envoi : redimensionnement au plus grand côté 2400 px, qualité 82, conversion en WebP. Traiter 200 fichiers de 4 Mo sans compression préalable est le premier point de rupture d'un back-office maison.
6. **File d'envoi.** Trois envois simultanés, barre de progression globale et par fichier, reprise automatique sur échec, possibilité d'annuler.
7. **Écriture en base.** Insertion dans `medias`, calcul du blurhash, journalisation dans `import_lots`.
8. **Rapport final.** Réussis, échoués, motifs. Bouton « Annuler ce lot » qui supprime les médias insérés par ce lot précis.

## 7.4 Import en masse des motos par CSV

Pour créer vingt fiches d'un coup depuis un tableur, avant même d'avoir les photos.

**Colonnes attendues :**

```csv
reference,marque,modele,annee,cylindree,categorie,etat,kilometrage,couleur,
puissance_ch,poids_kg,hauteur_selle_mm,refroidissement,transmission,abs,
prix_ttc,prix_valable_jusqu_au,garantie_mois,garantie_texte,
description,points_forts,fournisseur,statut
```

**Règles :**

- `prix_ttc` en Ariary, entier, sans séparateur.
- `points_forts` séparés par `|`.
- `fournisseur` par nom, résolu vers `fournisseur_id`, création si absent.
- `slug` généré automatiquement : `marque-modele-annee-reference`.
- Une référence déjà présente déclenche une **mise à jour**, pas un doublon.
- **Validation Zod avant toute écriture.** Si une seule ligne est invalide, rien n'est écrit et le rapport détaille la ligne et la colonne fautives. Un import partiel laisse une base incohérente qu'il faut nettoyer à la main.

Un **modèle CSV téléchargeable** est fourni depuis l'écran d'import.

## 7.5 Dérivés d'images

Générés par Cloudinary à la volée, servis via `next/image`.

| Usage | Largeur | Format | Qualité |
|---|---|---|---|
| Vignette back-office | 200 px | WebP | auto |
| Carte catalogue | 800 px | AVIF puis WebP | auto:good |
| Galerie fiche | 1400 px | AVIF puis WebP | auto:good |
| Plein écran | 2400 px | WebP | auto:best |

**Règles d'affichage :**

- Cadrage **4:3 imposé** sur toutes les vignettes et cartes. Des cartes de hauteurs inégales rendent la comparaison impossible, et comparer est le geste central de votre acheteur.
- Blurhash affiché pendant le chargement, jamais de zone vide.
- Filigrane discret « MOTO IMPORT » — médaillon du logo et signature — posé en bas à gauche des photos d'origine `reelle`. Vos concurrents les reprendront. Le coin droit reste au compteur « 3/12 » des galeries. La marque est fabriquée une fois par `npm run filigrane`, puis posée par Cloudinary quand il est branché, incrustée dès l'envoi quand il ne l'est pas, et rappelée en surcouche à l'écran tant que le fichier servi ne la porte pas — une capture d'écran enregistre ce qui est affiché.
- Photos constructeur sur fond blanc : appliquer une teinte de fond neutre côté Cloudinary pour éviter la rupture visuelle avec l'interface sombre.

## 7.6 Ajout rapide depuis un téléphone

Parcours distinct de l'import en masse, pour la mise à jour quotidienne.

`/admin/motos/nouvelle` en version mobile : formulaire en une colonne, prise de photo directe depuis l'appareil, réordonnancement par glisser-déposer tactile, publication en un bouton.

**Objectif chronométré : publier une moto en moins de cinq minutes depuis un téléphone.** C'est un critère de recette, pas un souhait.

---

# 8. SYSTÈME DE DESIGN

## 8.1 Le principe directeur

**On reprend la grammaire d'interaction de Facebook, pas son habillage.**

Ce que le public malgache connaît de Facebook, ce n'est pas le bleu : c'est *où sont les choses et comment elles réagissent*. Barre de navigation en bas, fil vertical de cartes pleine largeur, rangée de puces sous l'en-tête, barre d'actions sous chaque carte, feuilles qui remontent du bas. Zéro apprentissage.

L'habillage, lui, reste celui de la marque : noir et or, issus du logo. Reprendre le bleu de Facebook détruirait l'identité, et les photos de motos ressortent nettement mieux sur fond sombre.

**Ce qu'on refuse explicitement de Facebook :**

- Le fil infini sans structure. Facebook veut du temps passé ; vous voulez une décision d'achat. D'où des filtres toujours accessibles et un compteur de résultats.
- Les compteurs d'engagement. Vous n'avez pas d'audience au départ ; un « 0 j'aime » est un signal négatif.
- La densité et l'encombrement multi-colonnes.

## 8.2 Jetons de couleur

```css
--bg:          #0E1215;   /* fond général — gris asphalte, pas noir pur */
--surface:     #171C21;   /* cartes */
--surface-hi:  #1F262D;   /* champs, puces inactives */
--line:        #2B333B;   /* séparateurs */

--gold:        #C08A2E;   /* laiton — actions principales */
--gold-light:  #E7C983;   /* champagne — prix, accents textuels */
--chrome:      #B9C2CB;   /* texte secondaire, écho au lettrage du logo */
--text:        #F2F5F7;   /* texte principal */
--dim:         #8A939C;   /* texte tertiaire */

--dispo:       #45A55A;   /* disponible */
--reserve:     #4E86D6;   /* réservé */
--vendu:       #B8433C;   /* vendu */
--on-gold:     #12160F;   /* texte sur fond or */
```

Les trois couleurs de statut sont volontairement distinctes de l'or : un badge d'état doit se lire instantanément, sans être confondu avec un élément décoratif de la marque.

**Contraste :** tout texte doit atteindre au minimum 4,5:1. `--dim` sur `--bg` est réservé aux mentions non essentielles.

## 8.3 Typographie

Une seule famille, deux largeurs.

| Rôle | Police | Graisse |
|---|---|---|
| Interface, corps de texte | **Barlow** | 400 / 500 / 600 / 700 |
| Prix, grands nombres | **Barlow Condensed** | 700 / 800 |

Le condensé est réservé aux chiffres. Il évoque les numéros de course, économise la largeur sur écran étroit, et crée un contraste net sans introduire une seconde famille.

| Élément | Taille | Graisse | Police |
|---|---|---|---|
| Prix fiche produit | 42 px | 800 | Condensed |
| Prix carte catalogue | 30 px | 800 | Condensed |
| Titre fiche | 22 px | 700 | Barlow |
| Titre carte | 17 px | 600 | Barlow |
| Corps | 13,5 px | 400 | Barlow |
| Métadonnées | 12–13 px | 400 | Barlow |
| Badge | 10–11 px | 600 | Barlow |

## 8.4 L'élément signature

**Le prix est traité comme un numéro de course.** Grands chiffres condensés, couleur champagne, isolé entre deux filets horizontaux, avec en dessous la ligne « Prix final, rendu à Antananarivo. Carte grise établie à votre nom, incluse. »

C'est le seul endroit où l'interface hausse le ton. Tout le reste reste sobre. Sur un marché où la méfiance est l'obstacle principal, le prix tout compris n'est pas un détail de fiche technique : c'est l'argument.

## 8.5 Espacement et formes

- Grille de 4 px. Marge latérale : 16 px.
- Rayon : 8 px (cartes, boutons), 16 px (feuilles inférieures), plein (puces, badges).
- **Zone tactile minimale : 44 × 44 px.**
- Actions principales placées en bas d'écran, dans la zone du pouce.

## 8.6 Composants

| Composant | Comportement |
|---|---|
| `BarreSuperieure` | Fixe. Logo à gauche, loupe et filtres à droite. Fond translucide flouté. |
| `RangeePuces` | Défilement horizontal. Puce active en or, texte sombre. |
| `CarteMoto` | Galerie au balayage, bloc texte, barre d'actions à deux boutons. |
| `GalerieCarte` | Balayage horizontal, 5 vues, points de progression, compteur `3/12`. |
| `BadgeStatut` | Pastille colorée + libellé, sur fond sombre translucide. |
| `GalerieFiche` | Balayage sur toutes les vues, légende, bande de vignettes, plein écran au toucher. |
| `BlocPrix` | Élément signature, encadré de filets. |
| `FeuilleFiltres` | Remonte du bas. Budget au curseur, interrupteurs, bouton de validation. |
| `BarreActionFixe` | Fixe en bas de fiche. Enregistrer + Demander le devis. |
| `BarreInferieure` | 4 entrées : Catalogue, Enregistrées, Contact, Plus. |

## 8.7 Navigation

**Barre inférieure — 4 entrées seulement :**

| Entrée | Icône | Destination |
|---|---|---|
| Catalogue | maison | `/motos` |
| Enregistrées | signet | Sélection locale, badge du nombre |
| Contact | bulle | WhatsApp, téléphone, adresse du local |
| Plus | menu | Comment ça marche, FAQ, CGV, mentions légales |

**La recherche n'est pas dans la barre inférieure.** Elle vit en haut, sous la loupe, à côté du bouton de filtres. Deux entrées de recherche à deux endroits fragmentent l'usage.

## 8.8 États

- **Chargement :** squelettes au gabarit exact, jamais de rotative centrée.
- **Vide :** icône, titre, phrase d'explication, et **bouton d'action WhatsApp**. Un catalogue restreint transforme ainsi sa faiblesse en prise de contact : « Aucune moto ne correspond — dites-nous ce que vous cherchez. Nous sourçons sur commande. »
- **Erreur :** message en français simple, bouton « Réessayer », jamais de trace technique.

---

# 9. SPÉCIFICATION DES ÉCRANS PUBLICS

## 9.1 Accueil `/`

1. Bandeau : logo, accroche, deux boutons — « Voir le catalogue » et « Trouvez ma moto ».
2. Les trois faits imposés par les CGV — livraison 45-75 jours · carte grise à votre nom · prix final rendu Tana — ne sont pas répétés dans l'accroche : ils figurent sur chaque carte du catalogue et sur chaque fiche, là où ils servent à décider.
3. **Six motos disponibles** en avant, lien vers le catalogue.
4. **Entrée par budget** : trois paliers cliquables (moins de 10 M, 10-15 M, plus de 15 M Ar).
5. Le process en 5 étapes, condensé.
6. Pied de page.

## 9.2 Catalogue `/motos`

**En-tête fixe** : logo, loupe, bouton filtres (en or si un filtre est actif).
**Rangée de puces** : Toutes · Neuf · Occasion · Trail · Sportive · Roadster · Motocross · Custom.
**Compteur** : « 8 motos · commande 45 à 75 jours ».

**Feuille de filtres :**

| Filtre | Contrôle |
|---|---|
| Budget maximum | Curseur, pas de 500 000 Ar |
| Marque | Cases à cocher, avec effectifs |
| Cylindrée | 250-400 / 400-650 / 650-1000 / 1000+ |
| Année | Plage |
| Masquer les motos vendues | Interrupteur, **désactivé par défaut** |

**Filtres reflétés dans l'URL** (`/motos?cat=trail&max=15000000`) pour partager un lien pré-filtré dans une publication Facebook. Coût de développement quasi nul, rendement élevé.

**Carte du catalogue :**

```
┌─────────────────────────────┐
│ ●Disponible      Photos réelles│
│                             │
│   [galerie au balayage 4:3] │
│                             │
│      ▁▁▬▁▁          📷 3/12 │
├─────────────────────────────┤
│ Honda CB500X                │
│ 2021 · 471 cm³ · Occasion   │
│ · 18 400 km                 │
│                             │
│ 12 500 000 Ar               │  ← condensé, champagne
│ Rendu Antananarivo ·        │
│ Carte grise à votre nom     │
├──────────────┬──────────────┤
│ 🔖 Enregistrer│ 💬 Demander le devis│
└──────────────┴──────────────┘
```

**Tri par défaut :** `disponible`, puis `reserve`, puis `vendu`. Les motos vendues restent visibles, prix barré, en fin de liste.

## 9.3 Fiche produit `/motos/[slug]`

Ordre imposé, du plus décisif au moins :

1. **En-tête** : retour, titre, partage.
2. **Galerie** : balayage vue par vue, compteur `1/12`, légende sous la photo, bande de vignettes, plein écran au toucher. Les points d'usure sont marqués en rouge, jamais dissimulés en fin de série.
3. **Titre** et métadonnées.
4. **Bloc prix** — élément signature.
5. **Trois lignes de réassurance** : délai, carte grise, garantie.
6. **Fiche technique** en tableau.
7. **Bloc « État du véhicule »** — occasion uniquement : kilométrage, points d'usure listés honnêtement, mention « Photos prises le JJ/MM/AAAA au dépôt ».
8. **Description rédigée** — 150 à 300 mots recommandés, écrits par vous ; le back-office n'impose aucune longueur, seulement un texte non vide pour publier. Jamais traduits automatiquement du fournisseur : cela se repère immédiatement et détruit la crédibilité.
9. **Comment ça se passe** — les 5 étapes numérotées.
10. **Motos similaires** — 3 cartes.
11. **Barre d'action fixe** : Enregistrer + Demander le devis.

**Lien WhatsApp généré :**

```
Bonjour MOTO IMPORT, je suis intéressé par la
Honda CB500X 2021 (réf. MI-047) à 12 500 000 Ar.
```

Pour une moto vendue, le bouton devient « Trouvez-moi la même » avec un message adapté. **Une fiche vendue continue ainsi de générer des demandes** — c'est tout l'intérêt de conserver ces fiches en ligne, avec la preuve sociale et le référencement acquis.

Chaque clic est enregistré dans `demandes` **avant** la redirection.

## 9.4 Pages éditoriales

**`/comment-ca-marche`** — les 5 étapes en version illustrée. Cette page traite l'objection principale : « je paie d'avance quelque chose que je ne vois pas ». Elle mérite autant de soin qu'une fiche produit.

**`/faq`** — huit questions obligatoires : Pourquoi un acompte de 35 % ? · Que se passe-t-il si je me désiste ? · Le prix peut-il changer ? · Qui fait la carte grise ? · Puis-je voir la moto avant de payer ? · D'où viennent les motos ? · Que couvre la garantie ? · Livrez-vous en province ? Chaque réponse renvoie à l'article correspondant des CGV.

**`/contact`** — WhatsApp, téléphone, adresse, horaires, carte.

**`/cgv`** et **`/mentions-legales`** — contenu juridique intégral.

---

# 10. BACK-OFFICE

## 10.1 Tableau de bord `/admin`

- Demandes nouvelles non traitées, en tête.
- Motos dont le `prix_valable_jusqu_au` expire sous 7 jours.
- Motos publiées auxquelles il manque des vues du plan de prise de vue.
- Compteurs du mois : demandes, RDV, contrats signés.

## 10.2 Liste des motos `/admin/motos`

Tableau avec vignette, référence, désignation, prix, statut, nombre de photos et vues manquantes s'il en reste, date de mise à jour.

**Bascule de statut en un geste.** Sélecteur `Disponible / Réservé / Vendu` directement sur la ligne, **sans ouvrir la fiche et sans rechargement** : mise à jour optimiste, appel serveur en arrière-plan, retour visuel immédiat.

C'est l'action la plus fréquente de votre exploitation, faite depuis un téléphone juste après une signature au local. Si elle demande plus de deux touchers, le catalogue affichera des motos vendues comme disponibles, et vous perdrez des clients en leur promettant un véhicule qui n'existe plus.

Le passage en `vendu` renseigne automatiquement `date_vente`, retire la moto du tri prioritaire et applique le prix barré.

## 10.3 Édition d'une moto `/admin/motos/[id]`

Trois onglets : **Informations** · **Photos** · **Aperçu public**.

**Le statut ne se règle jamais depuis le formulaire.** Une fiche neuve n'a par
construction aucune photo — les photos s'ajoutent après l'enregistrement — donc
un formulaire de création qui proposerait « Disponible » ferait choisir un statut
que le verrou refuse toujours, en perdant la saisie. La création naît en
`brouillon` et le statut se change par son sélecteur, sur la ligne de la liste et
en tête de la fiche, qui affiche le refus sans rien faire perdre.

L'onglet Photos affiche la grille ordonnée, permet le réordonnancement par glisser-déposer, la modification de `vue`, `origine`, `legende`, `alt`, et signale les vues manquantes du plan de prise de vue.

**Contrôles avant publication** — bloquants :

- [ ] Plan de prise de vue complet — aucun seuil sur le nombre de photos
- [ ] Photo de couverture définie
- [ ] Description renseignée — aucun minimum de longueur, mais jamais vide
- [ ] Prix et date de validité renseignés
- [ ] Kilométrage et date de photos si occasion
- [ ] Texte de garantie renseigné
- [ ] Texte alternatif présent sur toutes les photos

## 10.4 Import `/admin/import`

Deux onglets : **Motos (CSV)** et **Photos (masse)**. Voir chapitre 7. Historique des lots avec possibilité d'annulation.

## 10.5 Demandes `/admin/demandes`

Vue liste et vue kanban par statut. Filtres par source et par période. Export CSV. Lien direct vers la conversation WhatsApp.

## 10.6 Fournisseurs `/admin/fournisseurs`

Accès **administrateur uniquement**. CRUD simple, avec le nombre de motos rattachées.

---

# 11. API ET ROUTES

| Route | Méthode | Accès | Rôle |
|---|---|---|---|
| `/api/demandes` | POST | Public, limité | Enregistre une demande avant redirection WhatsApp |
| `/api/upload/signature` | POST | Authentifié | Signature d'upload direct Cloudinary |
| `/api/import/motos` | POST | Authentifié | Import CSV, transaction unique |
| `/api/import/medias` | POST | Authentifié | Enregistrement d'un lot de médias |
| `/api/import/lots/[id]` | DELETE | Admin | Annulation d'un lot |
| `/api/motos/[id]/statut` | PATCH | Authentifié | Bascule de statut |
| `/api/revalidate` | POST | Interne | Invalidation du cache |

**Règles générales :** validation Zod systématique en entrée, jamais d'exposition de `fournisseur_id` sur une route publique, limitation à 5 requêtes par minute et par IP sur `/api/demandes`, réponses d'erreur normalisées `{ erreur: string, champ?: string }`.

---

# 12. SÉCURITÉ

## 12.1 Row Level Security

**Activée sur toutes les tables sans exception.**

```sql
alter table motos        enable row level security;
alter table medias       enable row level security;
alter table demandes     enable row level security;
alter table fournisseurs enable row level security;
alter table import_lots  enable row level security;

-- Lecture publique limitée aux motos non archivées
create policy motos_lecture_publique on motos
  for select using (statut <> 'archive');

create policy medias_lecture_publique on medias
  for select using (
    exists (select 1 from motos m where m.id = moto_id and m.statut <> 'archive')
  );

-- Fournisseurs : aucun accès anonyme
create policy fournisseurs_authentifie on fournisseurs
  for all using (auth.role() = 'authenticated');

-- Demandes : création anonyme, lecture réservée
create policy demandes_creation on demandes
  for insert with check (true);
create policy demandes_lecture on demandes
  for select using (auth.role() = 'authenticated');
```

## 12.2 Protection des fournisseurs

`fournisseur_id` figure dans la table `motos`, dont la lecture est publique. **Il ne doit jamais quitter le serveur.**

Deux mesures cumulatives :

1. Une **vue publique** `motos_publiques` excluant explicitement `fournisseur_id`, utilisée par toutes les requêtes côté public.
2. Un **test automatisé de non-régression** vérifiant qu'aucune réponse d'API publique ne contient la chaîne `fournisseur`.

C'est l'erreur la plus fréquente des projets Supabase et celle qui vous coûterait le plus cher.

## 12.3 Autres mesures

- Authentification par e-mail et mot de passe, deux comptes, rôles `admin` et `editeur`.
- Toutes les routes `/admin/*` protégées par un middleware côté serveur, pas seulement par un affichage conditionnel.
- Limitation de débit sur les routes publiques d'écriture.
- Aucune donnée personnelle en paramètre d'URL.
- Adresses IP stockées uniquement sous forme de hachage.
- En-têtes de sécurité : CSP, `X-Frame-Options`, `Referrer-Policy`.
- Secrets exclusivement en variables d'environnement Vercel, jamais versionnés.
- **Sauvegarde quotidienne** de la base, restauration testée au moins une fois avant la mise en production.

---

# 13. SEO, PERFORMANCE, ANALYTICS

## 13.1 Référencement

- URL lisibles : `/motos/honda-cb500x-2021-mi047`
- Titre : `Honda CB500X 2021 — 12 500 000 Ar rendu Tana | MOTO IMPORT`
- **Données structurées Schema.org `Vehicle` + `Offer`** sur chaque fiche.
- **Open Graph complet et image dédiée** générée par `opengraph-image.tsx` : photo de couverture, modèle, prix. Sans cela, vos partages Facebook s'affichent sans visuel et vous perdez la moitié de vos clics — c'est la fonctionnalité SEO la plus rentable de votre contexte.
- `sitemap.xml` régénéré à chaque publication ; `robots.txt` bloquant `/admin`.
- Mots-clés cibles : « moto 400cc Madagascar », « importation moto Tana », « acheter moto Antananarivo », « moto occasion Madagascar ».
- **Aucune fiche vendue n'est supprimée** : cela générerait des 404 sur vos liens Facebook et détruirait le référencement acquis. Statut `archive` réservé aux fiches erronées.

## 13.2 Performance

| Indicateur | Cible |
|---|---|
| LCP mobile | < 2,5 s |
| CLS | < 0,1 |
| INP | < 200 ms |
| Lighthouse mobile | ≥ 85 |

Images en `next/image` avec dimensions explicites, blurhash en substitut, chargement différé hors première vue, polices en `display: swap` avec préchargement.

## 13.3 Mesure

Vercel Analytics, Pixel Meta, Pixel TikTok.

**Événements à suivre :** `vue_fiche`, `clic_devis`, `enregistrement`, `filtre_applique`, `galerie_balayee`, `plein_ecran_ouvert`.

Le paramètre `source` est capté depuis l'UTM et écrit dans `demandes`. Sans lui, vous ne pourrez pas arbitrer vos 300 000 Ar de budget publicitaire mensuel.

---

# 14. ENVIRONNEMENTS ET DÉPLOIEMENT

## 14.1 Environnements

| Environnement | Branche | Base |
|---|---|---|
| Développement | locale | Supabase local |
| Préproduction | `develop` | Projet Supabase de test |
| Production | `main` | Projet Supabase de production |

## 14.2 Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY          # serveur uniquement
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_WHATSAPP_NUMBER
NEXT_PUBLIC_SITE_URL
REVALIDATE_SECRET
SENTRY_DSN
```

## 14.3 Coûts

| Poste | Coût annuel indicatif |
|---|---|
| Domaine `.com` | 60 000 – 90 000 Ar |
| Vercel Hobby | 0 Ar |
| Supabase Free | 0 Ar |
| Cloudinary Free | 0 Ar |
| Sentry Developer | 0 Ar |

Prenez un `.com` en V1. Le `.mg` coûte quatre à cinq fois plus cher pour un gain de crédibilité qui n'apparaîtra qu'une fois la marque installée.

**Seuils de vigilance :** Cloudinary bascule en payant vers 25 Go de bande passante mensuelle, Supabase vers 500 Mo de base ou 1 Go de stockage. À surveiller au-delà de 60 motos publiées.

---

# 15. PHASAGE ET DÉFINITION DE TERMINÉ

## V1 — Le minimum qui vend

| Lot | Contenu | Durée |
|---|---|---|
| 1 | Schéma de base, migrations, RLS, authentification | 3 j |
| 2 | Design system, composants de base | 4 j |
| 3 | Catalogue, filtres, cartes avec galerie | 5 j |
| 4 | Fiche produit, galerie plein écran, lien WhatsApp | 4 j |
| 5 | Back-office : CRUD, bascule de statut, photos | 5 j |
| 6 | **Import en masse : CSV + photos** | 4 j |
| 7 | Pages éditoriales, SEO, Open Graph | 3 j |
| 8 | Recette, corrections, mise en production | 3 j |

**Total estimé : environ 31 jours-homme.** À un rythme d'étudiant, comptez 8 à 10 semaines.

**Définition de terminé pour la V1 :**

- [ ] Une moto se publie en moins de 5 minutes depuis un téléphone
- [ ] 200 photos s'importent d'un coup par convention de nommage
- [ ] Un lien de fiche partagé sur Facebook affiche image, titre et prix
- [ ] Aucune réponse publique ne contient de donnée fournisseur
- [ ] Lighthouse mobile ≥ 85 sur catalogue et fiche
- [ ] Un clic « Demander le devis » crée une ligne en base puis ouvre WhatsApp
- [ ] Sauvegarde quotidienne active et restauration testée
- [ ] 8 à 12 motos complètes en ligne

**Ce dernier point est le vrai chemin critique.** En dessous de huit motos, les filtres n'ont aucun sens et le catalogue paraît abandonné. La production de contenu prendra plus de temps que le développement : commencez-la maintenant, en parallèle.

## V2 — Après les dix premières ventes

Page « Nos livraisons » avec photos de remise de clés — votre preuve sociale, qui vaut plus que tout argument technique · Suivi de commande par référence · Comparateur de 2 à 3 motos · Formulaire « Je cherche une moto » · Recherche textuelle complète · Newsletter · PWA installable.

## V3 — Si le volume le justifie

Espace client · Simulateur de budget · Blog · Version en malgache · Application mobile native.

## Ce qu'il ne faut pas faire en V1

Paiement en ligne · Comptes clients · Chat en direct (vous ne pourrez pas répondre assez vite, et un chat sans réponse nuit plus qu'il n'aide) · Avis clients (aucun contenu au départ) · Animations lourdes · Mode clair.

---

# 16. RECETTE

## 16.1 Fonctionnel

- [ ] Chaque filtre renvoie le bon sous-ensemble ; les filtres se cumulent
- [ ] L'URL reflète les filtres et un lien partagé les restitue
- [ ] Les motos vendues apparaissent en fin de liste, prix barré
- [ ] L'interrupteur « masquer les vendues » fonctionne et est désactivé par défaut
- [ ] Le résultat vide affiche l'action WhatsApp
- [ ] La galerie de carte se balaie sans déclencher l'ouverture de la fiche
- [ ] La galerie de fiche s'ouvre en plein écran et se ferme
- [ ] Le message WhatsApp contient référence, modèle et prix exacts
- [ ] Une fiche vendue propose « Trouvez-moi la même »
- [ ] La bascule de statut fonctionne sans rechargement
- [ ] L'import CSV rejette intégralement un fichier contenant une ligne invalide
- [ ] L'import photos regroupe correctement par référence et signale les orphelins
- [ ] L'annulation d'un lot supprime exactement les médias de ce lot
- [ ] La publication est bloquée s'il manque une vue du plan de prise de vue

## 16.2 Technique

- [ ] RLS vérifiée table par table avec une clé anonyme
- [ ] Aucune donnée fournisseur dans les réponses publiques
- [ ] `/admin` inaccessible sans session, y compris en accès direct
- [ ] Limitation de débit effective sur `/api/demandes`
- [ ] Sitemap et robots corrects
- [ ] Aucune erreur console en production
- [ ] Sentry reçoit bien les erreurs

## 16.3 Terrain

- [ ] Testé sur un Redmi d'entrée de gamme, Chrome Android
- [ ] Testé sur iPhone, Safari
- [ ] Utilisable à une main, pouce seul
- [ ] Textes français vérifiés par une personne tierce
- [ ] Prix affichés au format `12 500 000 Ar`, espaces insécables
- [ ] Chronomètre : publication d'une moto depuis un téléphone en moins de 5 minutes

---

# 17. ANNEXES

## 17.1 Format de la référence

```
MI-{NNN}
```
Séquentielle, jamais réutilisée. Figure sur le site, dans le message WhatsApp, sur le bon de commande et sur les noms de fichiers photo. C'est la clé qui relie l'ensemble du système, du fichier image jusqu'au contrat signé.

## 17.2 Codes de vue

| Code | Vue |
|---|---|
| `34ad` | 3/4 avant droit (couverture) |
| `pd` | Profil droit |
| `34ag` | 3/4 arrière gauche |
| `fa` | Face avant |
| `cpt` | Compteur |
| `mot` | Moteur |
| `ech` | Échappement |
| `pav` | Pneu avant |
| `par` | Pneu arrière |
| `sel` | Selle et commandes |
| `cha` | Numéro de châssis |
| `def1`…`defN` | Points d'usure |

Suffixe `-cat` : visuel constructeur.

## 17.3 Formatage de l'Ariary

```ts
export const ar = (n: number) =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F") + "\u00A0Ar";
// 12500000 → "12 500 000 Ar"
```

Espace fine insécable comme séparateur de milliers, espace insécable avant l'unité. Jamais de décimales.

## 17.4 Documents liés

| Document | Rôle |
|---|---|
| `CGV-MOTO-IMPORT.md` | Conditions générales — source des règles métier |
| `STRATEGIE-RESEAUX-MOTO-IMPORT.md` | Stratégie éditoriale et acquisition |
| `app-moto-import.jsx` | Prototype d'interface de référence |

## 17.5 Points ouverts à trancher avant le développement

1. **Seuil de révision de prix** (CGV art. 5.4) — 8 % proposé. Doit-il apparaître sur le site ?
2. **Garantie du neuf** — durée et organes couverts à figer, champ obligatoire.
3. **Livraison en province** — affichée en V1 ou traitée uniquement en conversation ?
4. **Numéro WhatsApp** — un seul numéro ou routage vers l'un des deux cofondateurs ?
5. **Accord d'associés** — à formaliser avant le premier contrat client. Ce n'est pas un point technique, mais c'est le seul de cette liste qui puisse arrêter le projet.