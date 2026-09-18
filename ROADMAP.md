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

### Vos vraies fiches (chemin critique : 8 à 12 fiches complètes)

- [ ] Créer les fournisseurs (onglet réservé à l'admin) **[Vous]**
- [ ] Créer les fiches, une à une ou par CSV (modèle dans l'onglet Import ; toute valeur contenant une virgule entre guillemets) **[Vous]**
- [ ] Ajouter les photos, trois angles minimum : 3/4 avant droit, 3/4 arrière gauche, face avant. Nommage : `MI-001_01_34ad.jpg` **[Vous]**
- [ ] Publier chaque fiche depuis le sélecteur de statut une fois les contrôles au vert **[Vous]**

### Domaine `motoimport.app`

- [x] Acheter le domaine sur Cloudflare **[Vous]**
- [x] L'ajouter dans Vercel (Settings → Domains) **[Vous]**
- [x] Créer dans Cloudflare les enregistrements DNS affichés par Vercel, en **DNS seul (nuage gris)** **[Vous]**
- [x] Passer `NEXT_PUBLIC_SITE_URL` à `https://motoimport.app` et redéployer **[Claude]**
- [x] Vérifier HTTPS, liens canoniques, sitemap et images Open Graph sur le nouveau domaine **[Claude]**

---

## 2. Fortement recommandé

- [ ] **Relier Vercel au dépôt GitHub** (Settings → Git) : chaque `git push` redéploiera tout seul. Aujourd'hui les mises en ligne sont manuelles **[Vous]**
- [ ] **Mesurer ce qui compte** : le seul indicateur décisif est le nombre de contrats signés attribués au site
  - [ ] Vercel Analytics **[Claude]**
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
