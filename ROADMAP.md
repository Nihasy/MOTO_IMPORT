# Roadmap avant ouverture — MOTO IMPORT

Ce qui reste à faire avant d'ouvrir le site au public. On coche au fur et à
mesure en remplaçant `[ ]` par `[x]`.

Qui s'en charge : **[Vous]** dans vos consoles ou pour vos décisions,
**[Claude]** dans le code et les déploiements, **[Ensemble]** pour les deux.

Site en ligne : https://motoimport.app · Dépôt : https://github.com/Nihasy/MOTO_IMPORT

---

## 1. Bloquant — avant d'ouvrir au public

### Changer les secrets passés en clair dans la conversation (urgent)

- [ ] **Supabase** : régénérer le JWT Secret (Project Settings → API), ce qui renouvelle les clés `anon` et `service_role` **[Vous]**
  - [ ] Reporter les deux nouvelles clés dans Vercel et dans `.env.local` **[Claude]**
- [ ] **Cloudinary** : régénérer l'API Secret (Settings → API Keys) **[Vous]**
  - [ ] Reporter le nouveau secret dans Vercel et dans `.env.local` **[Claude]**
- [ ] **Comptes du back-office** : choisir deux mots de passe **distincts**, l'actuel étant partagé par les deux comptes **[Vous]**
  - [ ] Mettre à jour `ADMIN_ACCOUNTS` et redéployer **[Claude]**

### Coordonnées modifiables depuis le back-office

- [x] Supabase → SQL Editor : coller et exécuter `supabase/migrations/0008_parametres.sql` (crée la table `parametres`) **[Vous]**
- [ ] Back-office → Paramètres : vérifier le numéro WhatsApp, le téléphone, l'adresse et les horaires, puis **Enregistrer** une première fois **[Vous]**

### Tarification dynamique (prix calculés depuis le yuan)

- [x] Supabase → SQL Editor : exécuter `supabase/migrations/0009_tarification.sql` **après** la 0008 **[Vous]**
- [ ] Back-office → Tarification : vérifier le taux du yuan, le fret, le bénéfice (2 000 000 Ar + 10 %), puis **Enregistrer** une première fois **[Vous]**
- [x] Supabase → SQL Editor : exécuter `supabase/migrations/0010_mise_en_vente.sql` (mise en vente : sur commande ou déjà au local) **[Vous]**
- [ ] Saisir le prix d'achat en ¥ de chaque fiche : sans lui, une fiche ne peut pas être publiée **[Vous]**
- [ ] Mettre à jour le taux du yuan chaque semaine **[Vous]**
- [x] Faire relire les CGV (art. 4 et 5.3) par un juriste : validées **[Vous]**

### Vos vraies fiches (chemin critique : 8 à 12 fiches complètes)

- [ ] Créer les fournisseurs (onglet réservé à l'admin) **[Vous]**
- [ ] Créer les fiches, une à une ou en masse par CSV : Import → « Modèle vide » ou « Modèle avec 2 exemples », remplir dans Excel, importer. Toutes naissent en brouillon **[Vous]**
- [ ] Ajouter les photos, trois angles minimum : 3/4 avant droit, 3/4 arrière gauche, face avant. Nommage : `MI-001_01_34ad.jpg` **[Vous]**
- [ ] Publier : liste des motos → « Publier les brouillons prêts » (photos, prix en ¥ et description en place), ou fiche par fiche depuis le sélecteur de statut **[Vous]**

### Domaine `motoimport.app`

- [x] Acheter le domaine sur Cloudflare **[Vous]**
- [x] L'ajouter dans Vercel (Settings → Domains) **[Vous]**
- [x] Créer dans Cloudflare les enregistrements DNS affichés par Vercel, en **DNS seul (nuage gris)** **[Vous]**
- [x] Passer `NEXT_PUBLIC_SITE_URL` à `https://motoimport.app` et redéployer **[Claude]**
- [x] Vérifier HTTPS, liens canoniques, sitemap et images Open Graph sur le nouveau domaine **[Claude]**

---

## 2. Fortement recommandé

- [x] **Déploiement automatique à chaque `git push` sur `main`** : le compte GitHub `Nihasy` est déjà relié à un autre compte Vercel, l'intégration Git de Vercel est donc remplacée par GitHub Actions (`.github/workflows/deploy.yml`). Jeton Vercel « MOTO », portée `moto-import`, sans expiration : s'il est révoqué, en recréer un et remplacer le secret `VERCEL_TOKEN`
  - [x] Écrire le workflow de déploiement **[Claude]**
  - [x] Vercel (compte `motoimportcontact`) → Account Settings → Tokens : créer un jeton, sans expiration ou d'un an **[Vous]**
  - [x] GitHub → dépôt `MOTO_IMPORT` → Settings → Secrets and variables → Actions → New repository secret : `VERCEL_TOKEN` = le jeton **[Vous]**
  - [x] Lancer le workflow une fois (onglet Actions → Run workflow) et vérifier la mise en ligne **[Ensemble]**
- [ ] **Mesurer ce qui compte** : le seul indicateur décisif est le nombre de contrats signés attribués au site
  - [x] Vercel Analytics : pages vues, hors `/admin` et `/connexion`, et événements `vue_fiche`, `clic_devis`, etc. Tableau de bord : Vercel → moto-import → Analytics **[Claude]**
  - [ ] Pixel Meta : me donner l'identifiant du pixel **[Vous]**, l'intégrer **[Claude]**
  - [ ] Pixel TikTok : me donner l'identifiant du pixel **[Vous]**, l'intégrer **[Claude]**
  - [ ] Sentry : créer le compte et me donner le DSN **[Vous]**, l'intégrer **[Claude]**
- [ ] **Sauvegardes**
  - [ ] Vérifier ce que l'offre gratuite Supabase inclut en sauvegardes **[Vous]**
  - [ ] Automatiser un export régulier de la base **[Claude]**
  - [ ] Tester une restauration complète au moins une fois **[Ensemble]**

---

## 3. Après les premières fiches

- [ ] Mesurer Lighthouse mobile sur le catalogue et sur une vraie fiche : cible 85 **[Claude]**
- [ ] Trancher les cinq points ouverts de l'annexe 17.5 du cahier des charges **[Vous]**
  - [ ] Seuil de révision de prix
  - [ ] Durée de garantie du neuf
  - [ ] Livraison en province
  - [ ] Numéro WhatsApp unique ou routé
  - [ ] Accord d'associés

---

## 4. Points techniques mineurs

- [ ] Remplir les variables de l'environnement **Preview** dans Vercel, utile seulement si vous utilisez des branches d'aperçu **[Claude]**
- [ ] Compteur partagé pour la limite de tentatives de connexion (Upstash ou Vercel KV). Aujourd'hui chaque instance serveur compte séparément **[Ensemble]**
- [ ] Occasion : faut-il rendre obligatoire la photo du compteur ? Les CGV (art. 3.4) promettent des photos mentionnant le kilométrage relevé au compteur **[Vous]**

---

## Déjà fait — 17 et 18 septembre 2026

- [x] Création de fiche en brouillon, statut réglé par son propre sélecteur, saisie conservée en cas de refus
- [x] Description facultative à la saisie, non vide pour publier, affichée sur la fiche publique
- [x] Plan de prise de vue allégé à trois angles
- [x] Filigrane : incrusté par Cloudinary à la livraison, jamais de photo publiée sans marque
- [x] Déploiement en production sur Vercel, base Supabase, photos sur Cloudinary
- [x] Comptes admin et éditrice, numéro WhatsApp réel
- [x] Tests de sécurité (68 défenses, 0 faille) et de concurrence (20 sur 20)
- [x] Correction de trois défauts de concurrence du pilote Supabase et du poids des pages (2,8 Mo ramenés à 32 Ko)
- [x] Base nettoyée, sauvegarde conservée dans `data/sauvegardes/avant-nettoyage-2026-09-18.json`
- [x] Domaine `motoimport.app` en service : DNS Cloudflare en DNS seul vers la cible Vercel du projet (`CNAME` sur `@` et `www`), `www` redirigé en 308 vers l'adresse sans `www`, liens canoniques, Open Graph, `robots.txt` et sitemap sur le nouveau domaine
- [x] Mise en ligne automatique à chaque `git push` sur `main` par GitHub Actions
- [x] Rendu grand écran (tablette et ordinateur) : navigation dans l'en-tête, fiche sur deux colonnes avec prix et actions dans un panneau fixe, accroche avec moto à la une, filtres du catalogue sur une ligne. Rendu mobile inchangé, vérifié au pixel près
- [x] ~~Acompte fixe de 70 %~~ remplacé le jour même par la tarification dynamique ci-dessous
- [x] Adresse, horaires, numéro WhatsApp et téléphone modifiables dans le back-office (onglet Paramètres, compte admin), repris sur la page Contact, les liens de devis et le bouton d'appel
- [x] Page 404 aux couleurs du site : en-tête, navigation, pied de page, liens utiles
- [x] Mobile : la barre de navigation du bas ne sort plus de l'écran sur l'accueil (débordement de 18 px sous 408 px) ; toutes les pages vérifiées de 320 à 414 px
- [x] Tarification dynamique : prix de vente calculé depuis le prix d'achat en ¥ (taux, fret et papiers fixes, bénéfice = fixe + part du prix d'achat, arrondi), acompte propre à chaque moto (45 à 80 %, couvre l'achat), solde à la remise des clés et des papiers. Section « Tarification » du back-office avec simulateur et aperçu des prix avant recalcul ; prix figés dès la réservation et à l'arrivée au local. Prix d'achat, taux et réglages invisibles du public et du compte éditeur
- [x] Séparateurs de milliers pendant la saisie dans le back-office (prix en ¥, réglages, kilométrage)
- [x] CGV : acompte de 45 à 80 % propre à chaque véhicule (art. 4.2), solde à la remise des clés et des papiers (4.3), prix modifiables avant signature (5.3)
- [x] Import en masse : modèles CSV vide et avec exemples (points-virgules, accents et dates lisibles par Excel), guide des colonnes, virgules ou points-virgules et dates 31/12/2026 acceptées. Toute fiche importée naît en brouillon ; une fiche existante garde son statut
- [x] Publication en masse des brouillons prêts, sous le même verrou que la publication une à une
- [x] Mise en vente choisie dès la saisie (fiche ou colonne CSV `disponibilite`) : sur commande ou déjà au local. La publication en masse publie chaque fiche sous son statut (« Disponible sur commande » ou « Disponible de suite »)
- [x] Recette de production (19 septembre 2026) : pages, HTTPS, redirections, en-têtes de sécurité, référencement, rendu mobile et ordinateur, protections des API et de la base vérifiés ; titre du catalogue pour les moteurs, favicon, titre de l'accueil sans doublon
