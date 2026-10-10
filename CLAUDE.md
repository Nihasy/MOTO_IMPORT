# MOTO IMPORT

Catalogue d'importation de motos depuis la Chine vers Antananarivo. Next.js 15
(App Router), Supabase, Cloudinary. Site public `motoimport.app` + back-office
sous `/admin`.

## Commandes

```bash
npm run recette        # LE garde-fou : e2e + sécurité + charge. Zéro échec attendu.
npm test               # vitest, ~308 tests
npx tsc --noEmit       # typecheck
npm run lint           # ESLint (règles Next) : zéro problème attendu, `next build` le relance
npm run build          # build de production (prégénère les fiches publiées)
npm run filigrane      # refabrique public/filigrane.png
node scripts/lire-refs.mjs   # dernière référence MI-xxx réellement en base
node scripts/menage-cloudinary.mjs   # photos Cloudinary que plus rien n'utilise (simulation)
```

Supprimer une photo ou annuler un lot n'efface que la ligne en base : le
fichier reste sur Cloudinary. `menage-cloudinary.mjs` les retrouve, `--supprimer`
les efface. Le lancer après chaque import de lot.

`npm run recette` joue contre le magasin JSON local, **jamais** contre Supabase :
elle écrit pour de bon (crée des demandes, vend MI-001). `scripts/env-local.mjs`
l'empêche de viser la production.

## Le piège des variables d'environnement

**`.env.local` pointe sur la Supabase de PRODUCTION.** Le nom trompe : seul
`NEXT_PUBLIC_SITE_URL` est local. Un `npm run dev` ou un `npm run build` lancé
tel quel lit et écrit la vraie base.

Pour travailler sur le magasin JSON local, vider les trois variables — elles
doivent être **vides et non absentes**, car `@next/env` ne recouvre que ce qui
est `undefined` :

```bash
NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= NEXT_PUBLIC_SUPABASE_ANON_KEY= \
  npm run seed
NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= NEXT_PUBLIC_SUPABASE_ANON_KEY= \
  npx next dev -p 3100
```

Le compte de recette est déclaré en tête de `scripts/e2e.mjs`. Le back-office
se teste sans passer par le formulaire, en forgeant le cookie signé comme le
fait ce script : HMAC-SHA256 de la charge base64url avec `AUTH_SECRET`, cookie
`mi_session`.

> **À traiter.** Ce mot de passe est écrit en clair dans `scripts/e2e.mjs`, donc
> publiquement lisible, et c'est aussi celui d'`ADMIN_ACCOUNTS`. Si la production
> porte la même valeur, le back-office de `motoimport.app` est ouvert à qui lit
> le dépôt. À dissocier : un compte de recette propre au magasin local, et un
> mot de passe de production qui ne vit que dans les variables Vercel.

**Un script lancé sous `tsx` ou `node` ne lit pas `.env.local` tout seul** — Next
le fait, eux non. Sans lecture explicite, `supabaseConfigure()` est faux et
`db()` bascule en silence sur `data/local-db.json`. Voir `chargerEnvLocal()` dans
`scripts/deposer-lot.ts` : tout script qui écrit doit annoncer sa base et la
vérifier après coup.

## Déploiement

**La production est sur le compte Vercel `hei.nihasy`, équipe MOTO**
(`moto-7b13`, `team_kmlVqIxo3fQHbi1ixuN5cWhW`, projet `moto-import`), au forfait
**Pro** depuis le 10/10/2026. Ce n'est ni le compte relié à GitHub ni celui
branché sur Claude : le connecteur Vercel de Claude ne voit pas ce projet. La
CLI du PC, elle, y est connectée.

`.github/workflows/deploy.yml` vise encore l'ancien compte (`motoimportcontact`,
en pause) : chaque push sur `main` échoue à l'étape « Déployer sur Vercel » et
**ne met rien en ligne**. Tant que le secret `VERCEL_TOKEN` et les identifiants
du workflow ne sont pas remplacés, on déploie à la main depuis une copie propre :
`git clone --depth 1`, copier `.vercel/project.json`, puis
`npx vercel@latest deploy --prod --yes --scope moto-7b13 --cwd <copie>`. Sans
`--scope`, Vercel répond « Not authorized ».

Lire l'état de l'équipe (blocage, forfait) :
`MSYS_NO_PATHCONV=1 npx vercel api "/v2/teams/team_kmlVqIxo3fQHbi1ixuN5cWhW"`.
Sous Git Bash, sans `MSYS_NO_PATHCONV`, le chemin est transformé et la CLI
refuse l'appel.

Vercel détient les variables sensibles ; la construction se fait chez lui.

## Cache et quotas Vercel

Le 10/10/2026, le site a répondu `402 DEPLOYMENT_DISABLED` : l'équipe gratuite
avait dépassé ses écritures de cache (`dataCacheWrite`). Le catalogue et les
fiches se réécrivaient toutes les heures. **Le catalogue en cache et les pages
publiques durent désormais un jour** (`lib/catalogue-public.ts`, `revalidate =
86400`), et `tests/quota-cache.test.ts` refuse un délai plus court.

**Mesure d'audience Vercel (Web Analytics) : rebranchée le 10/10/2026, au forfait
Pro seulement.** Elle compte les pages vues du site public, sans cookie
(`components/ui/mesure-audience.tsx`, back-office et connexion exclus), et deux
événements rares : `clic_devis` et `enregistrement` (`VERS_VERCEL` dans
`lib/analytics.ts`). Chaque millier d'événements coûte 0,03 $ au-delà de
l'inclus. Les événements fréquents (`galerie_balayee`, `vue_fiche`, filtres,
recherche) avaient mis l'ancien compte gratuit en pause le 30/09 : ils ne vont
qu'aux pixels Facebook et TikTok, et `tests/quota-cache.test.ts` refuse qu'on
les envoie à Vercel. Sur un forfait gratuit, débrancher la mesure.

Le back-office vide le cache à chaque écriture. Un script qui écrit en base sans
passer par lui doit le vider lui-même, sinon le site garde l'ancien catalogue
jusqu'au lendemain : `POST /api/revalidate` (session ou en-tête
`x-revalidate-secret`), ou `npx vercel cache invalidate --tag catalogue --yes
--scope moto-7b13` depuis un dossier lié au projet.

## Sources uniques de vérité

| Sujet | Fichier |
|---|---|
| Colonnes du CSV d'import, dans l'ordre | `COLONNES_CSV` — `lib/csv.ts` |
| Codes de vue photo (annexe 17.2) | `CODES_VUE` — `lib/medias.ts` |
| Vues exigées pour publier | `VUES_OBLIGATOIRES` — `lib/medias.ts` (`34ad`, `34ag`, `fa`) |
| Règle et géométrie du filigrane | `marquable`, `couche()` — `lib/cloudinary.ts` |
| Marques proposées au filtre | `MARQUES_CONNUES` — `lib/marques.ts` |
| Noms courants des types pour la recherche (« naked », « adv »…) | `SYNONYMES_CATEGORIE` — `lib/recherche.ts` |
| Bornes d'acompte, délais de livraison, de retrait et de gardiennage | `ACOMPTE_MIN`, `DELAI_MAX`… — `lib/conditions.ts` |

Ne jamais dupliquer ces listes : elles servent à la fois au fichier
téléchargeable, au guide affiché et à la validation.

## Filigrane

Toute image publiée porte la marque, **visuels constructeur compris** (décision
du 23/09/2026, qui revient sur le 7.5 du cahier des charges). Seule exception :
la vignette de 200 px du back-office, affaire de lisibilité et non de propriété.

Le filigrane Cloudinary est le fichier `moto-import/filigrane`
(`NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID`). Aucune ligne `medias` ne le référence,
mais **sans lui, toute photo non encore en cache renvoie une erreur 400** : le
25/09/2026, un ménage l'a effacé et 21 fiches ont perdu leurs photos. On le
refabrique à partir de `public/filigrane.png`, sous le même identifiant.
`menage-cloudinary.mjs` ne touche plus qu'aux dossiers `moto-import/MI-xxx/`.

Une seule règle, `marquable()`, mais trois moteurs la posent — Cloudinary à la
livraison, le canvas à l'envoi quand Cloudinary est absent, une surcouche CSS
tant que les pixels servis ne la portent pas. **Changer la règle sans aligner les
trois laisse des photos nues.**

## Conventions

- Tout est en français : noms de fonctions, variables, commentaires, interface.
- Les commentaires expliquent **pourquoi**, pas quoi. Beaucoup consignent un
  détour déjà payé — les lire avant de « simplifier ».
- Messages de commit : une phrase déclarative en français, sans préfixe
  conventionnel. « Le plein écran glisse au lieu de sauter ».
- Les scripts PowerShell restent en **ASCII pur** : PowerShell 5.1 relit un
  `.ps1` UTF-8 sans BOM comme de l'ANSI, et un tiret cadratin casse le parseur.

## Import d'un lot fournisseur

Voir le skill `lot-album-wechat`. En résumé : les références s'attribuent à la
suite du maximum **réel en base** (`node scripts/lire-refs.mjs`), jamais d'après
le CSV précédent — une référence existante déclenche une mise à jour silencieuse
au lieu d'une création. Tout naît en `brouillon` ; la publication est un geste
manuel.

Les photos passent par le back-office (Import → Photos), jamais par un script :
le navigateur compresse, calcule le blurhash et signe l'envoi. Un fichier nommé
`MI-058_03_34ad` désigne une **place** sur la fiche. S'il est renvoyé, le
serveur l'ignore au lieu de le ranger à la suite (`siOrdrePris: "ignorer"`) :
c'est ce décalage qui avait doublé huit fiches publiées le 25/09/2026. Après
chaque lot, `node scripts/menage-cloudinary.mjs` doit annoncer 0 orphelin.

Le mode automatique de Claude Code refuse les suppressions en production
(Supabase, Cloudinary), même demandées explicitement. Préparer la commande, la
simuler, puis laisser l'utilisateur la lancer avec `! commande`.

## Contenu de la page Facebook

Scripts, concepts, chiffres de la page et stratégie vivent dans un dépôt **privé**
à part, `Desktop\MOTO_IMPORT_CONTENU` : celui-ci est lisible publiquement, rien de
ce contenu n'y entre. Deux skills s'en servent : `contenu-moto-import` (écrire,
valider, revisiter un script ou un concept) et `suivi-page-moto` (mesurer la page
dans Metricool et tenir le doc de suivi).

Les scripts ne promettent que ce que disent le contrat et les CGV, résumés article
par article dans `MOTO_IMPORT_CONTENU/referentiel/faits.md`. **Toute modification
de `lib/conditions.ts`, de `app/(public)/cgv/page.tsx`, de la FAQ ou du contrat
PDF doit être reportée
dans ce fichier le jour même**, sinon les vidéos promettront l'ancienne règle
(l'acompte de 45 à 80 % selon la moto en est l'exemple : les légendes disaient
60 %).
