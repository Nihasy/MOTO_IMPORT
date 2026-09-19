# MOTO IMPORT

Catalogue de motocycles importés pour MOTO IMPORT (Antananarivo).
Implémentation du cahier des charges `goal.md`, version 2.0.

Ce n'est **pas** une boutique en ligne : ni panier, ni paiement, ni compte
client. La vente se conclut au local par signature d'un bon de commande et
versement d'un acompte propre à chaque moto (45 à 80 %, solde à la remise des clés et des papiers). L'application convertit le visiteur en
conversation WhatsApp qualifiée, et rien de plus.

## Démarrer

```bash
npm install
npm run seed     # 10 motos de démonstration, 102 photos, 5 demandes
npm run dev
```

L'application tourne **sans aucun compte externe**. En l'absence de variables
Supabase, le pilote de données bascule sur un magasin local JSON
(`data/local-db.json`) ; en l'absence de Cloudinary, les photos compressées
dans le navigateur sont conservées telles quelles. Voir `.env.example`.

Back-office : <http://localhost:3000/admin>
Comptes de développement (à remplacer via `ADMIN_ACCOUNTS` en production) :

| Compte | Mot de passe | Rôle |
|---|---|---|
| `nihasy@moto-import.mg` | `moto-import-2026` | admin |
| `editrice@moto-import.mg` | `moto-import-2026` | editeur |

## Vérifier

```bash
npm run typecheck      # TypeScript strict
npm test               # tests unitaires
npm run build
npm start &
npm run test:e2e       # recette fonctionnelle (chapitre 16)
npm run test:securite  # tests d'intrusion actifs
npm run test:charge    # concurrence et charge
```

- `scripts/e2e.mjs` couvre le chapitre 16 : filtres, tri, fiche, fuite
  fournisseur, limitation de débit, bascule de statut, import CSV
  transactionnel, annulation de lot.
- `scripts/securite.mjs` **tente activement des attaques** : forge de jeton,
  élévation de privilège, contournement du middleware, XSS stocké dans les
  données structurées, traversée de répertoire, pollution de prototype,
  falsification d'adresse source, corps démesurés, redirection ouverte.
  « OK » signifie que l'attaque a échoué.
- `scripts/charge.mjs` éprouve 50 clients simultanés en lecture, les écritures
  concurrentes, et les courses à l'écriture sur une même référence.

Les deux derniers scripts ont besoin d'une session : renseignez `AUTH_SECRET`
et `ADMIN_ACCOUNTS` dans `.env.local` avant de les lancer.

## Sécurité

Choix structurants, tous éprouvés par `scripts/securite.mjs` :

| Mesure | Où |
|---|---|
| Échec fermé sans `AUTH_SECRET`/`ADMIN_ACCOUNTS` en production | `lib/config.ts` |
| Sessions HMAC, comparaison à durée constante, rôle validé à la relecture | `lib/auth.ts` |
| Mot de passe comparé à durée constante, sans court-circuit | `lib/auth.ts` |
| Destination de redirection restreinte au back-office | `destinationSure()` |
| Données structurées échappées avant insertion dans `<script>` | `lib/jsonld.ts` |
| Limitation à deux étages : par adresse **et** globale | `lib/securite.ts` |
| Table du limiteur bornée et purgée | `lib/securite.ts` |
| Corps de requête et lots d'import bornés | `corpsJsonBorne()`, routes d'import |
| Adresses IP hachées avec sel, jamais en clair | `hacherIp()` |
| CSP sans `unsafe-eval` en production, HSTS, COOP, CORP, pas de `X-Powered-By` | `next.config.mjs` |
| Écriture atomique du magasin local (fichier temporaire + renommage) | `lib/db/local.ts` |
| Création/mise à jour par référence en une seule opération atomique | `enregistrerParReference()` |

### Deux limites à connaître

**La limitation de débit est locale au processus.** Derrière plusieurs
instances serverless, la limite effective est multipliée par leur nombre. Pour
une protection stricte, brancher un compteur partagé (Vercel KV, Upstash) sur
l'interface `limiterDebit`.

**L'identification du client dépend de la plateforme.** `x-forwarded-for` est
falsifiable par le client ; le code privilégie `x-vercel-forwarded-for` puis
`x-real-ip`, posés par le relais. Derrière un autre hébergeur, vérifiez quel
en-tête est réellement de confiance. C'est précisément pour cela que l'étage
global existe : il tient même quand l'adresse est falsifiée.

## Architecture

```
app/(public)      Accueil, catalogue, fiche, pages éditoriales
app/admin         Back-office (tableau de bord, motos, import, demandes, fournisseurs)
app/connexion     Authentification — hors du layout admin pour éviter la boucle de garde
app/api           Routes d'écriture, toutes validées par Zod
components/       ui · catalogue · fiche · admin
lib/              format · schemas · whatsapp · medias · csv · auth · securite
lib/db/           Interface `Pilote` + deux implémentations (supabase, local)
supabase/         Migrations SQL versionnées (schéma, RLS, vue publique)
```

### Pilote de données

`lib/db/index.ts` choisit l'implémentation selon l'environnement. Les deux
pilotes respectent la même interface `Pilote`, et **aucun des deux** ne renvoie
`fournisseur_id` sur une lecture publique : la fonction `publier()` le retire,
la vue SQL `motos_publiques` ne le sélectionne pas, et un test de
non-régression vérifie qu'aucune réponse publique ne contient la chaîne
`fournisseur`.

### Concurrence

Mesures sur un poste de développement, magasin JSON local :

| Scénario | Résultat |
|---|---|
| 50 clients simultanés sur `/motos` | 51 req/s, p95 1 249 ms, aucune erreur |
| 50 clients simultanés sur une fiche | 300 req/s, p95 191 ms |
| 40 demandes simultanées | 40 enregistrées, aucune perdue |
| 8 imports simultanés de la même référence | 1 création, 7 mises à jour |
| 12 médias insérés en parallèle | 12 retrouvés, aucun écrasement |
| Lectures publiques pendant écritures admin | toutes servies |

La fiche est neuf fois plus rapide que le catalogue parce qu'elle est générée
statiquement, là où le catalogue est rendu à chaque requête — le cahier des
charges impose ce rendu dynamique pour que les filtres vivent dans l'URL.

## Points d'attention pour la maintenance

- **Aucun `loading.tsx` ne doit couvrir `/motos/[slug]`.** Une frontière
  Suspense au-dessus de cette route diffuse un statut 200 avant que
  `notFound()` puisse s'exécuter : chaque slug inconnu devient un soft-404
  indexable. Le squelette du catalogue vit dans `<Suspense>` à l'intérieur de
  la page `/motos`.
- **`lib/cloudinary.ts` doit rester importable côté client.** La signature
  d'upload, qui dépend de `node:crypto`, vit dans `lib/cloudinary-serveur.ts`.
- Toute modification en back-office déclenche `revalidatePath` sur la fiche
  concernée, `/motos` et `/`.
- **Ne jamais insérer de valeur issue de la base dans un `<script>` sans
  passer par `jsonLdSecurise`.** `JSON.stringify` n'échappe pas `<` : une
  description peut refermer la balise et exécuter du script sur une page
  publique.
- **Toute création liée à une clé unique passe par `enregistrerParReference`.**
  Un « lire puis écrire » en deux temps laisse une fenêtre où deux imports
  simultanés créent deux fiches.

## Mise en production

1. Créer le projet Supabase, appliquer `supabase/migrations/*.sql` dans l'ordre.
   Puis reprendre les données du magasin local :

   ```
   npm run vers-supabase -- --essai      # compte les lignes, n'écrit rien
   npm run vers-supabase -- --sauf-references=MI-901,MI-903
   ```

   Les identifiants sont conservés, les liaisons moto → média → lot restent
   valides, et une seconde exécution met à jour au lieu de dupliquer. Par
   défaut seuls `fournisseurs`, `motos` et `medias` partent : les demandes et
   les lots du magasin local sont surtout des artefacts de recette.
2. Créer les deux comptes dans Supabase Auth, ou renseigner `ADMIN_ACCOUNTS`.
3. Créer le compte Cloudinary, renseigner les trois variables.
4. Générer `AUTH_SECRET`, `IP_SALT` et `REVALIDATE_SECRET`.
5. Déployer sur Vercel, brancher le domaine, activer la sauvegarde quotidienne
   Supabase et **tester une restauration** avant l'ouverture au public.

### Domaine

`motoimport.app`, enregistré chez Cloudflare. Trois points à ne pas manquer :

- `NEXT_PUBLIC_SITE_URL=https://motoimport.app` dans les variables Vercel
  (portée Production). Elle est **figée à la construction** : la modifier sans
  redéployer laisse les liens canoniques, le sitemap et les images Open Graph
  sur l'ancienne adresse.
- Les enregistrements DNS à créer sont ceux que le tableau de bord Vercel
  affiche pour le domaine ajouté — ne pas les recopier de mémoire, ils
  changent. Sur Cloudflare, laisser ces entrées en **DNS seul** (nuage gris) :
  le proxy orange devant Vercel empile deux CDN, et le mode SSL « Flexible »
  provoque une boucle de redirection. Si le proxy est voulu malgré tout, mode
  SSL **Full (strict)** obligatoire.
- L'extension `.app` est inscrite d'office dans la liste HSTS des navigateurs :
  le site n'est **joignable qu'en HTTPS**, sans repli en clair. L'en-tête
  `Strict-Transport-Security` est déjà envoyé en production
  (`next.config.mjs`), rien à ajouter.

> **`npm run test:e2e` écrit dans la base que sert le serveur visé.** Une fois
> Supabase branché, la recette y créerait ses fiches MI-901 et MI-903 et ses
> lots de photos. Lancez-la contre un magasin local :
> `LOCAL_DB_PATH=/tmp/recette.json npm run dev` dans un terminal, la recette
> dans l'autre — ou contre un second projet Supabase, jamais celui de
> production.

## Reste à faire avant l'ouverture

Points qui ne relèvent pas du développement mais conditionnent la recette
finale du chapitre 15 :

- Produire 8 à 12 fiches réelles complètes — c'est le chemin critique.
- Trancher les cinq points ouverts de l'annexe 17.5 (seuil de révision de prix,
  durée de garantie du neuf, livraison en province, numéro WhatsApp unique ou
  routé, accord d'associés).
- Mesurer Lighthouse mobile sur le catalogue et une fiche réelle, avec de
  vraies photos : la cible de 85 ne peut pas se vérifier sur des placeholders.
- Brancher Sentry, le Pixel Meta et le Pixel TikTok.

### Tarification (information interne)

Le prix de vente ne se saisit pas : il se calcule à partir du prix d'achat en
yuan (`lib/tarification.ts`), avec les réglages de l'onglet **Tarification**
du back-office (compte admin).

- `prix de vente = achat + fret et papiers + bénéfice fixe + part × achat`,
  arrondi au palier supérieur ;
- `acompte = achat × (1 + sécurité change) ÷ prix`, arrondi au 5 % supérieur,
  borné à 45–80 % par les CGV (`lib/conditions.ts`) ;
- les prix suivent les réglages tant que la moto est en brouillon ou
  disponible sur commande ; ils sont figés à la réservation, à la vente et à
  l'arrivée au local.

Le prix en yuan, le taux et les réglages ne quittent jamais le serveur vers le
public ni vers le compte éditeur : `publier()` les retire, la vue publique ne
les contient pas, et la migration 0009 restreint la lecture de la table
`motos` aux seules colonnes publiques. Les chiffres par défaut vivent dans
`lib/tarification-defaut.ts`, que seul le serveur importe.

En développement avec le magasin JSON local, React joint au code des pages les
lectures de fichier pour ses outils de débogage : la base locale entière y
apparaît. Cela n'existe pas en production (vérifié sur une construction de
production).
