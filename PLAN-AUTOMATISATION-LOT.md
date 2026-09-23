# Plan — automatisation des lots fournisseurs

Objectif : ramener le traitement d'un lot hebdomadaire de plusieurs heures à
deux commandes et une relecture.

Écrit après le lot du 20/09/2026 (17 motos, 130 photos, 2 fournisseurs), fait
entièrement à la main. Ce document part de ce qui a réellement coûté du temps
ce jour-là.

---

## 1. Ce qu'un script peut faire, et ce qu'il ne peut pas

Le partage est net, et c'est lui qui dicte toute l'architecture.

**Automatisable — l'essentiel du volume**

| Tâche | Temps manuel (lot du 20/09) |
|---|---|
| Lire 17 `desc.txt` en chinois, en extraire année / km / prix | ~20 min |
| Convertir les kilométrages approximatifs | ~5 min |
| Attribuer les références à la suite de la base | ~5 min |
| Renommer et copier 130 photos | ~30 min si fait à la main |
| Écrire le CSV au format attendu | ~15 min |
| Vérifier que les noms de fournisseurs existent déjà | ~5 min |

**Non automatisable — le jugement**

| Tâche | Pourquoi |
|---|---|
| `BM` → BMW R nineT, `Z100` → Kawasaki Z1000, `YAMAHA` → Yamaha YZF-R1 2014 | Les noms de dossier sont des abréviations du fournisseur, sans règle |
| Cylindrée, catégorie, puissance, refroidissement | Absentes de la source, déduites du modèle |
| Classer 130 photos par angle de vue | Demande de regarder les images |
| Rédiger les descriptions françaises | Rédaction commerciale |

Conséquence : **le script prépare et structure, je complète le jugement.**
Il ne cherche jamais à deviner un modèle. Ce qu'il ne sait pas, il le signale.

---

## 2. Commande cible

```bash
npm run lot -- Moto_27_09_26          # prépare
npm run lot:deposer -- Moto_27_09_26  # écrit en base, après relecture
```

Déroulé attendu :

```
Moto_27_09_26 — 14 dossiers, 2 fournisseurs

  lus          12 motos (année, km, prix trouvés)
  incomplets    2 motos (voir ci-dessous)
  alias connus 10 / 14
  à compléter   4 modèles inconnus, 14 jeux de vues

→ scripts/lot/travail/Moto_27_09_26.json
→ planches-contact : .../planches/
```

Je remplis le JSON (modèles inconnus + vues), puis relance la même commande :
elle produit le dossier `PRET_A_IMPORTER/`.

---

## 3. Étapes

### 3.1 — Lecture du dossier source

Convention constante depuis le début :

```
Moto_JJ_MM_AA/
  NOM_FOURNISSEUR;CONTACT/
    NOM_MODELE/
      desc.txt
      mmexport*.jpg
```

Le `;` sépare le nom du fournisseur de son contact. Le nom du fournisseur doit
correspondre exactement à un `fournisseurs.nom` en base (`MOTO_200STOCK`,
`MOTO_GROSSE`) — sinon l'import en crée un doublon silencieux. **Le script
vérifie ça en base avant toute autre chose et s'arrête si ça ne correspond pas.**

### 3.2 — Parseur de `desc.txt`

C'est la pièce qui mérite le plus de soin, et la seule qui mérite des tests.
Exemples réels du lot du 20/09 :

```
15年宝马拿铁，公里数：30000，价格：35800
2018年铃木GSX-1000F  ABS带TC，车况精品发动机无拆修。公里数：几千公里   价格：28800元
16年新款雅马哈R1顶配版！…（3 lignes de description）…3万多公里，6万元
```

Trois champs à extraire, dans un ordre et une ponctuation variables :

- **Année** : `(\d{2,4})年`. Deux chiffres → préfixer `20`.
- **Kilométrage** : après `公里数` ou seul devant `公里`. Formes rencontrées :
  `30000`, `26000公里`, `1万多`, `2万多`, `3万多`, `几千`.
- **Prix** : après `价格`, en `元`. Formes : `35800`, `28800元`, `6万元`, `3万`.

Conversions fixées (décidées le 20/09, ne plus redemander) :

| Source | Valeur retenue |
|---|---|
| `1万多` | 15 000 |
| `2万多` | 25 000 |
| `3万多` | 35 000 |
| `几千` | 5 000 |
| `N万` | N × 10 000 |

Le parseur ne devine pas : un champ absent laisse la moto **incomplète**, elle
sort du CSV et est listée. Un `desc.txt` vide (cas ZX-10R du 20/09) doit
produire exactement ça, sans planter.

Tests à écrire dans `tests/lot-desc.test.ts` : les 16 descriptions réelles du
lot du 20/09 servent de jeu d'essai, avec leurs résultats attendus.

### 3.3 — Dictionnaire des modèles

`scripts/lot/modeles.json`, indexé par alias de dossier, par fournisseur :

```json
{
  "MOTO_200STOCK": {
    "MT09":   { "marque": "Yamaha", "modele": "MT-09", "cylindree": 847,
                "categorie": "roadster", "refroidissement": "liquide",
                "transmission": "6 rapports", "puissance_ch": 115 },
    "TMAX16": { "marque": "Yamaha", "modele": "T-MAX 530 ABS", "cylindree": 530,
                "categorie": "scooter", "refroidissement": "liquide",
                "transmission": "Variateur automatique", "puissance_ch": 46 }
  },
  "MOTO_GROSSE": {
    "BM":   { "marque": "BMW", "modele": "R nineT", "cylindree": 1170, "…": "…" },
    "Z100": { "marque": "Kawasaki", "modele": "Z1000", "cylindree": 1043, "…": "…" }
  }
}
```

Amorcé avec les 17 alias du lot du 20/09. Un alias inconnu n'est pas une erreur :
il est listé en fin d'exécution pour que je l'ajoute. Le fichier grandit à chaque
lot ; au bout de trois ou quatre, les modèles récurrents sont couverts.

Attention : un même alias peut désigner deux motos différentes selon l'année
(`R1` existe chez les deux fournisseurs, en 2014 et 2016). La clé de recherche
est donc **alias + année**, avec repli sur l'alias seul.

### 3.4 — Angles de vue

Pas de reconnaissance d'image dans le script. Il fait deux choses :

1. Génère une **planche-contact numérotée** par moto (grille 3 colonnes,
   vignettes 300 px, badge du numéro en haut à gauche) — exactement ce qui a
   servi le 20/09.
2. Pré-remplit le JSON de travail avec `"vues": ["autre", "autre", …]`, un
   élément par photo, dans l'ordre alphabétique des fichiers.

Je lis les planches, je remplace par les vrais codes. Le script vérifie ensuite
que chaque moto porte au moins **`34ad`, `34ag` et `fa`** — les trois vues
qu'exige `VUES_OBLIGATOIRES` dans `lib/medias.ts` — et refuse de générer sinon.

La photo `_01_` est toujours la première `34ad` : c'est la couverture.

### 3.5 — Références

Lecture de la base, `max(reference)`, puis attribution à la suite. Le script
**refuse** d'attribuer une référence déjà prise — une référence existante
déclenche une mise à jour de fiche, pas une création, et ça passerait inaperçu.

### 3.6 — Génération

Sortie dans `<lot>/PRET_A_IMPORTER/` :

- `motos-AAAA-MM-JJ.csv` — séparateur `;`, BOM UTF-8, colonnes dans l'ordre de
  `COLONNES_CSV` (`lib/csv.ts`, source unique). Pas de colonne `statut`.
- `photos/` — `{REF}_{ORDRE}_{VUE}.jpg`
- `LISEZ-MOI.md` — tableau des motos avec prix calculés, points à vérifier,
  motos exclues et pourquoi

Puis **validation immédiate** du CSV produit par `analyserCsvMotos()` du projet,
avec les réglages lus en base. Si le parseur du site refuse le fichier, le script
échoue : il ne livre jamais un CSV que le site rejettera.

### 3.7 — Dépôt

`tmp-deposer.ts` (racine, écrit le 20/09) promu en `scripts/deposer-lot.ts`,
avec deux ajouts :

- `--dry-run` **par défaut** : affiche ce qui serait écrit, n'écrit rien.
  Il faut `--ecrire` pour toucher la base.
- Refus si une référence du CSV existe déjà en base sans `--mettre-a-jour`.

Il rejoue la boucle de `app/api/import/motos/route.ts` avec les mêmes fonctions
(`analyserCsvMotos`, `enregistrerParReference`, `creerLot`), sans la couche HTTP.
Toute fiche naît en `brouillon`.

---

## 4. Ce qui reste manuel, définitivement

**Les photos passent par le navigateur.** La compression 2400 px, la conversion
WebP et le calcul du blurhash se font côté client avant l'envoi signé vers
Cloudinary (`lib/upload-client.ts`). Un script en ligne de commande produirait
des médias sans blurhash, hors pipeline. Donc : Back-office → Import → Photos,
glisser le dossier.

**La publication reste un geste humain.** Rien ne part en vente sans relecture.

---

## 5. Fichiers à créer

```
scripts/lot/
  index.mjs        pipeline : lecture → JSON de travail → génération
  desc.mjs         parseur des desc.txt chinois
  planches.mjs     planches-contact numérotées
  modeles.json     dictionnaire des alias fournisseur (amorcé, 17 entrées)
  travail/         JSON intermédiaires, non versionnés
scripts/deposer-lot.ts   (déplacer tmp-deposer.ts, + --dry-run)
tests/lot-desc.test.ts   16 cas réels du lot du 20/09
```

Deux entrées dans `package.json` : `lot` et `lot:deposer`.

---

## 6. Phasage

Chaque phase est utilisable seule — pas besoin d'aller au bout pour en tirer
quelque chose.

| Phase | Contenu | Gain |
|---|---|---|
| **1** | Parseur `desc.txt` + tests + planches-contact | Supprime la lecture manuelle du chinois et la fabrication des planches |
| **2** | Dictionnaire des modèles + JSON de travail + génération CSV/photos | Le gros du gain : plus de renommage ni de CSV à la main |
| **3** | `deposer-lot.ts` avec `--dry-run`, garde-fou sur les références | Dépôt sûr et répétable |
| **4** | Validation du CSV produit, contrôle des vues obligatoires | Plus jamais de fichier rejeté à l'import |

Après la phase 2, un lot devrait coûter : la commande, la lecture des planches
et l'écriture des descriptions — le reste est fait.

---

## 7. Dettes du lot du 20/09 à reprendre

- **MI-020, Kawasaki Ninja ZX-10R** — hors catalogue, `desc.txt` vide.
  Manque année, kilométrage, prix. Ses 9 photos sont déjà renommées dans
  `Moto_20_09_26/PRET_A_IMPORTER/photos/`.
- **Kilométrages MI-004 → MI-013** — arrondis (15 000 / 25 000 / 35 000) faute
  de chiffre exact côté 200STOCK. À confirmer avant publication.
- **Fiches techniques** — puissance, refroidissement, transmission et ABS
  viennent des fiches constructeur, pas du fournisseur. Poids et hauteur de
  selle laissés vides volontairement.
- **Côté gauche/droite des vues 3/4 et profil** — non garanti. N'affecte que le
  texte alternatif, ni l'ordre ni la validation.
