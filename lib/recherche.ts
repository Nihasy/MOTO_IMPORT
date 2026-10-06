import { LIBELLE_CATEGORIE, POIDS_STATUT, type Categorie, type MotoPublique, type Statut } from "@/lib/types";

/**
 * Moteur de recherche du catalogue, en mémoire.
 *
 * Le catalogue tient en quelques centaines de fiches : les noter toutes à
 * chaque frappe coûte moins d'une milliseconde, et évite toute lecture en base
 * (le quota d'egress Supabase est déjà dépassé, voir `catalogue-public.ts`).
 *
 * Repris du moteur de 261° WEAR — normalisation, préfixes, fautes de frappe,
 * champs pondérés, repli approximatif — puis adapté à ce qu'un acheteur tape
 * pour une moto : des modèles écrits de dix façons (« CB500X », « cb 500 x »,
 * « CB-500X »), des cylindrées et des millésimes qui ne tolèrent aucune faute
 * (« 2022 » n'est pas « 2023 », « 125 » n'est pas « 1250 »), et des types
 * désignés par leur nom courant (« naked », « adv », « enduro »).
 *
 * Seuls des champs publics sont indexés : jamais le prix d'achat, le
 * fournisseur ni la marge, qui passent pourtant par les mêmes objets côté
 * serveur.
 */

/** Minuscules, sans accents ni ponctuation. « Routière » → « routiere », « cm³ » → « cm3 ». */
export function normaliser(s: string): string {
  return s
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Mots qui ne disent rien de la moto cherchée. « moto honda » doit trouver les
 * Honda, et « MI-177 » la référence 177 : sans cette liste, « moto » et « mi »
 * devraient figurer dans chaque fiche pour que la recherche aboutisse.
 */
const MOTS_VIDES = new Set([
  "moto", "motos", "de", "du", "des", "d", "la", "le", "les", "l", "un", "une",
  "et", "en", "a", "au", "aux", "pour", "avec", "sur", "cc", "cm", "cm3", "mi",
]);

/** Mots de la requête, normalisés, sans doublon, huit au plus. */
export function decouper(q: string | undefined): string[] {
  const mots = normaliser(q ?? "").split(" ").filter((m) => m && !MOTS_VIDES.has(m));
  return [...new Set(mots)].slice(0, 8);
}

/**
 * Distance d'édition avec transposition (« yamha » → « yamaha » vaut 1, pas
 * 2 : l'inversion de deux lettres est la faute de frappe la plus courante).
 * Abandonne dès que `max` est dépassé.
 */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = b.length;
  let avantDernier: number[] = [];
  let dernier = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const ligne = [i];
    let mini = i;
    for (let j = 1; j <= n; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(dernier[j] + 1, ligne[j - 1] + 1, dernier[j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, avantDernier[j - 2] + 1);
      }
      ligne[j] = v;
      if (v < mini) mini = v;
    }
    if (mini > max) return max + 1;
    avantDernier = dernier;
    dernier = ligne;
  }
  return dernier[n];
}

const NOMBRE = /^\d+$/;

/**
 * Note d'un mot de la requête contre un mot indexé : exact > préfixe > faute
 * de frappe > inclusion.
 *
 * Un nombre ne se compare qu'à un nombre entier : « 125 » trouve une
 * 125 cm³ et la K3-125D, jamais la R 1250 GS dont il n'est que le début, et
 * « 2022 » ne passe pas pour « 2023 » à une faute près.
 *
 * `flou` permet les fautes et l'inclusion. On le refuse aux textes longs
 * (description, points forts) : à une lettre près, « trail » y trouvait
 * « train » et « trait ».
 */
export function noteMot(jeton: string, mot: string, flou = true): number {
  if (mot === jeton) return 1;
  if (NOMBRE.test(jeton)) {
    return mot.startsWith(jeton) && !/\d/.test(mot[jeton.length]) ? 0.8 : 0;
  }
  if (mot.startsWith(jeton)) return jeton.length >= 2 ? 0.8 : 0.4;
  if (!flou) return 0;
  if (jeton.length >= 4 && !/\d/.test(jeton)) {
    const max = jeton.length >= 7 ? 2 : 1;
    const d = Math.min(
      distance(jeton, mot, max),
      distance(jeton, mot.slice(0, jeton.length), max),
      distance(jeton, mot.slice(0, jeton.length + max), max)
    );
    if (d <= max) return 0.55 - d * 0.1;
  }
  if (jeton.length >= 3 && mot.includes(jeton)) return 0.35;
  return 0;
}

export type ChampRecherche = {
  texte: string;
  poids: number;
  /** Fautes de frappe et inclusion admises (vrai par défaut). */
  flou?: boolean;
  /**
   * Ajoute les formes collées et découpées : « MT-07 » s'indexe aussi
   * « mt07 », « CB500X » aussi « cb », « 500 » et « x ». Réservé aux noms
   * courts (marque, modèle, référence) : sur une description, il ne
   * produirait que du bruit.
   */
  formes?: boolean;
};

export type ChampPrepare = { poids: number; flou: boolean; mots: string[] };

/** Morceaux lettres / chiffres d'un mot mixte : « cb500x » → cb, 500, x. */
const morceaux = (mot: string) => mot.match(/[a-z]+|\d+/g) ?? [];

export function preparerChamps(champs: ChampRecherche[]): ChampPrepare[] {
  return champs.map((c) => {
    const texte = normaliser(c.texte);
    const mots = texte.split(" ").filter(Boolean);
    const tous = new Set(mots);
    if (c.formes) {
      for (const m of mots) for (const p of morceaux(m)) tous.add(p);
      for (let i = 0; i + 1 < mots.length; i++) tous.add(mots[i] + mots[i + 1]);
      if (mots.length > 1) tous.add(mots.join(""));
    }
    return { poids: c.poids, flou: c.flou !== false, mots: [...tous] };
  });
}

/** Ce que l'index lit d'une moto : rien d'autre ne peut ressortir d'une recherche. */
export type MotoIndexable = Pick<
  MotoPublique,
  "marque" | "modele" | "reference" | "categorie" | "etat" | "annee" | "cylindree"
> &
  Partial<Pick<MotoPublique, "couleur" | "description" | "points_forts" | "abs" | "statut">>;

/**
 * Noms courants de chaque type. Le catalogue affiche « Cross » ou « Trail »,
 * l'acheteur tape aussi bien « enduro », « naked » ou « adventure ».
 */
export const SYNONYMES_CATEGORIE: Record<Categorie, string> = {
  routiere: "routiere touring tourisme gt voyage",
  sportive: "sportive sport sportbike supersport hypersport piste racing",
  roadster: "roadster naked streetfighter",
  trail: "trail adventure aventure adv baroudeuse",
  custom: "custom cruiser bobber chopper",
  motocross: "cross motocross enduro dirt tout terrain tt pitbike pit bike offroad",
  scooter: "scooter maxiscooter",
};

const SYNONYMES_ETAT = { neuf: "neuf neuve neufs neuves new", occasion: "occasion occas used" };

const SYNONYMES_STATUT: Partial<Record<Statut, string>> = {
  dispo_immediate: "disponible dispo suite immediat immediatement stock tana antananarivo",
  disponible: "disponible dispo commande",
  reserve: "reserve reservee",
  vendu: "vendu vendue",
};

/** Surnoms des marques, au-delà de ce que les préfixes trouvent déjà. */
const SURNOMS_MARQUE: Record<string, string> = {
  "harley davidson": "harley hd",
  kawasaki: "kawa",
  qjmotor: "qj qianjiang",
  "qj motor": "qjmotor qianjiang",
  cfmoto: "cf chunfeng",
  "royal enfield": "enfield",
  "mv agusta": "agusta",
  "moto guzzi": "guzzi",
  "segway powersports": "segway",
  kove: "colove",
};

/** Cylindrée commerciale : 649 cm³ se cherche « 650 », 998 cm³ « 1000 ». */
function cylindreeRonde(cc: number): number | null {
  const rond = Math.round(cc / 50) * 50;
  return rond !== cc && Math.abs(rond - cc) <= Math.max(6, cc * 0.015) ? rond : null;
}

export function champsMoto(m: MotoIndexable): ChampRecherche[] {
  const marque = normaliser(m.marque);
  const rond = cylindreeRonde(m.cylindree);
  const cc = [m.cylindree, rond].filter((x): x is number => x !== null);
  return [
    { texte: m.modele, poids: 4, formes: true },
    { texte: `${m.marque} ${SURNOMS_MARQUE[marque] ?? ""}`, poids: 3, formes: true },
    { texte: m.reference, poids: 4, formes: true, flou: false },
    { texte: `${LIBELLE_CATEGORIE[m.categorie] ?? ""} ${SYNONYMES_CATEGORIE[m.categorie] ?? ""}`, poids: 2 },
    { texte: cc.flatMap((x) => [`${x}`, `${x}cc`, `${x}cm3`]).join(" "), poids: 2.5 },
    { texte: String(m.annee), poids: 1.5 },
    { texte: SYNONYMES_ETAT[m.etat] ?? "", poids: 1.5 },
    { texte: `${m.couleur ?? ""} ${m.abs ? "abs" : ""}`, poids: 1 },
    { texte: (m.statut && SYNONYMES_STATUT[m.statut]) ?? "", poids: 0.8, flou: false },
    { texte: (m.points_forts ?? []).join(" "), poids: 0.7, flou: false },
    { texte: m.description ?? "", poids: 0.5, flou: false },
  ];
}

/**
 * Index d'une moto, gardé tant que l'objet vit. La signature protège d'un
 * objet modifié sur place (le magasin local le fait) : un index périmé ferait
 * trouver une moto sous son ancien nom.
 */
const indexMemo = new WeakMap<object, { signature: string; champs: ChampPrepare[] }>();

function indexMoto(m: MotoIndexable): ChampPrepare[] {
  const signature = [
    m.marque, m.modele, m.reference, m.categorie, m.etat, m.annee, m.cylindree,
    m.couleur, m.abs, m.statut, m.description?.length, m.points_forts?.length,
  ].join("|");
  const deja = indexMemo.get(m);
  if (deja && deja.signature === signature) return deja.champs;
  const champs = preparerChamps(champsMoto(m));
  indexMemo.set(m, { signature, champs });
  return champs;
}

/**
 * Noteur pour une requête. Les notes mot × mot sont retenues : quelques
 * milliers de mots distincts au catalogue, contre dix fois plus d'occurrences.
 *
 * Tous les mots de la requête doivent trouver un écho (recherche « ET ») :
 * « honda 2023 » restreint au lieu d'élargir. Avec `ouLogique`, il suffit d'un
 * mot, et la note est pondérée par la part de mots trouvés — c'est le repli
 * quand la recherche stricte ne rend rien.
 */
export function creerNoteur(jetons: string[]) {
  const memo = jetons.map(() => new Map<string, number>());
  const colle = jetons.join("");
  return (champs: ChampPrepare[], ouLogique = false): number => {
    if (!jetons.length) return 1;
    let total = 0;
    let trouves = 0;
    for (let i = 0; i < jetons.length; i++) {
      let meilleur = 0;
      for (const c of champs) {
        const cle = c.flou ? "f" : "s";
        for (const mot of c.mots) {
          const k = cle + mot;
          let n = memo[i].get(k);
          if (n === undefined) memo[i].set(k, (n = noteMot(jetons[i], mot, c.flou)));
          if (n * c.poids > meilleur) meilleur = n * c.poids;
        }
      }
      if (meilleur > 0) trouves++;
      else if (!ouLogique) return 0;
      total += meilleur;
    }
    if (ouLogique) return trouves ? total * (trouves / jetons.length) : 0;
    // Requête tapée d'un trait dans le nom du modèle (« honda cb » devant
    // « Honda CBR », « cb500 » devant « CB500F ») : elle passe en tête.
    if (jetons.length > 1 && champs.slice(0, 2).some((c) => c.mots.some((m) => m.startsWith(colle)))) {
      total += 1.5;
    }
    return total;
  };
}

/** Vrai si tous les mots de la requête trouvent un écho dans la fiche. */
export function correspond(m: MotoIndexable, q: string | undefined): boolean {
  const jetons = decouper(q);
  return !jetons.length || creerNoteur(jetons)(indexMoto(m)) > 0;
}

/** Même règle sur des textes quelconques (recherche du back-office). */
export function correspondTextes(textes: string[], q: string | undefined): boolean {
  const jetons = decouper(q);
  if (!jetons.length) return true;
  return creerNoteur(jetons)(preparerChamps(textes.map((texte) => ({ texte, poids: 1, formes: true })))) > 0;
}

export type Trouvee<T> = { moto: T; note: number };

/**
 * Motos qui répondent à la requête, avec leur note. Sans mot utile, tout le
 * catalogue passe, note nulle. Quand la recherche stricte ne rend rien, le
 * repli « OU » renvoie les plus proches et le dit (`approximatif`).
 */
export function rechercherMotos<T extends MotoIndexable>(
  motos: T[],
  q: string | undefined
): { trouvees: Trouvee<T>[]; approximatif: boolean; jetons: string[] } {
  const jetons = decouper(q);
  if (!jetons.length) return { trouvees: motos.map((moto) => ({ moto, note: 0 })), approximatif: false, jetons };
  const noter = creerNoteur(jetons);
  const strictes = motos
    .map((moto) => ({ moto, note: noter(indexMoto(moto)) }))
    .filter((t) => t.note > 0);
  if (strictes.length) return { trouvees: strictes, approximatif: false, jetons };
  const proches = motos
    .map((moto) => ({ moto, note: noter(indexMoto(moto), true) }))
    .filter((t) => t.note > 0);
  return { trouvees: proches, approximatif: proches.length > 0, jetons };
}

/**
 * Ordre de pertinence. Le statut prime, comme pour tous les tris du
 * catalogue : une moto vendue ne passe pas devant une moto livrable parce
 * qu'elle colle mieux à la requête. À statut égal, la meilleure note, puis la
 * plus récente.
 */
export function trierParPertinence<T extends Pick<MotoPublique, "statut" | "created_at">>(
  motos: T[],
  note: (m: T) => number
): T[] {
  return [...motos].sort(
    (a, b) =>
      POIDS_STATUT[a.statut] - POIDS_STATUT[b.statut] ||
      note(b) - note(a) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/** Découpe `texte` en morceaux, ceux qui répondent à un mot de la requête marqués (pour <mark>). */
export function surligner(texte: string, jetons: string[]): { texte: string; trouve: boolean }[] {
  if (!jetons.length) return [{ texte, trouve: false }];
  const parts: { texte: string; trouve: boolean }[] = [];
  for (const bout of texte.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? []) {
    const n = normaliser(bout).replace(/ /g, "");
    const trouve =
      n !== "" &&
      jetons.some((j) => noteMot(j, n) > 0.3 || morceaux(n).some((p) => noteMot(j, p) >= 0.8));
    const dernier = parts[parts.length - 1];
    if (dernier && dernier.trouve === trouve) dernier.texte += bout;
    else parts.push({ texte: bout, trouve });
  }
  return parts;
}
