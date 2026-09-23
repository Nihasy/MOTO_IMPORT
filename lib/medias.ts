import { slugifier } from "./format";
import type { Etat, Media, Origine, Vue } from "./types";

/** Codes de vue de l'annexe 17.2 -> enum `vue_photo`. */
export const CODES_VUE: Record<string, Vue> = {
  "34ad": "34_avant_droit",
  pd: "profil_droit",
  "34ag": "34_arriere_gauche",
  fa: "face_avant",
  cpt: "compteur",
  mot: "moteur",
  ech: "echappement",
  pav: "pneu_avant",
  par: "pneu_arriere",
  sel: "selle",
  cha: "chassis",
};

export type FichierAnalyse = {
  fichier: string;
  reference: string;
  ordre: number;
  code: string;
  vue: Vue;
  origine: Origine;
  valide: true;
};

export type FichierInvalide = { fichier: string; valide: false; motif: string };

export type Analyse = FichierAnalyse | FichierInvalide;

const EXT = /\.(jpe?g|png|webp|heic|heif|avif)$/i;

/** {REFERENCE}_{ORDRE}_{CODE_VUE}[-cat].{ext} */
export function analyserNomFichier(nomComplet: string): Analyse {
  const fichier = nomComplet.split(/[\/]/).pop() ?? nomComplet;
  if (!EXT.test(fichier)) {
    return { fichier, valide: false, motif: "Extension non supportee" };
  }
  const sansExt = fichier.replace(EXT, "");
  const m = sansExt.match(/^(MI-\d{3,})_(\d{1,3})_([a-z0-9]+?)(-cat)?$/i);
  if (!m) {
    return { fichier, valide: false, motif: "Nom illisible : attendu MI-047_01_34ad.jpg" };
  }
  const [, reference, ordreBrut, codeBrut, cat] = m;
  const ordre = Number(ordreBrut);
  if (!Number.isInteger(ordre) || ordre < 1) {
    return { fichier, valide: false, motif: "Numero d'ordre invalide" };
  }
  const code = codeBrut.toLowerCase();
  let vue: Vue;
  if (CODES_VUE[code]) vue = CODES_VUE[code];
  else if (/^def\d*$/.test(code)) vue = "defaut";
  else vue = "autre";

  return {
    fichier,
    reference: reference.toUpperCase(),
    ordre,
    code,
    vue,
    origine: cat ? "constructeur" : "reelle",
    valide: true,
  };
}

export type GroupeReference = {
  reference: string;
  fichiers: FichierAnalyse[];
  doublonsOrdre: number[];
};

export type ResultatAnalyse = {
  groupes: GroupeReference[];
  invalides: FichierInvalide[];
};

export function grouperParReference(noms: string[]): ResultatAnalyse {
  const groupes = new Map<string, FichierAnalyse[]>();
  const invalides: FichierInvalide[] = [];
  for (const nom of noms) {
    const a = analyserNomFichier(nom);
    if (!a.valide) invalides.push(a);
    else {
      const liste = groupes.get(a.reference) ?? [];
      liste.push(a);
      groupes.set(a.reference, liste);
    }
  }
  return {
    groupes: [...groupes.entries()]
      .map(([reference, fichiers]) => {
        fichiers.sort((x, y) => x.ordre - y.ordre);
        const vus = new Set<number>();
        const doublonsOrdre: number[] = [];
        for (const f of fichiers) {
          if (vus.has(f.ordre)) doublonsOrdre.push(f.ordre);
          vus.add(f.ordre);
        }
        return { reference, fichiers, doublonsOrdre };
      })
      .sort((a, b) => a.reference.localeCompare(b.reference)),
    invalides,
  };
}

/**
 * Plan de prise de vue exigé avant publication.
 *
 * Il n'existe pas de seuil chiffré de photos : les lots reçus des ateliers
 * partenaires comptent un nombre variable de clichés, et un nombre ne dit rien
 * de ce qui est montré. Ce sont ces angles-là qui sont exigés — une fiche peut
 * en compter davantage, jamais moins que cette liste.
 *
 * Trois angles seulement : ceux qui donnent la silhouette complète du véhicule.
 * Exiger le compteur, le moteur, les deux pneus et la selle retenait en
 * brouillon des motos parfaitement présentables, pour des clichés que les
 * ateliers n'envoient pas toujours. Ces vues restent prévues et s'affichent
 * quand elles existent ; elles ne conditionnent plus la mise en vente.
 */
export const VUES_OBLIGATOIRES: Record<Etat, Vue[]> = {
  neuf: ["34_avant_droit", "34_arriere_gauche", "face_avant"],
  occasion: ["34_avant_droit", "34_arriere_gauche", "face_avant"],
};

export function vuesManquantes(medias: Pick<Media, "vue">[], etat: Etat): Vue[] {
  const presentes = new Set(medias.map((m) => m.vue));
  return VUES_OBLIGATOIRES[etat].filter((v) => !presentes.has(v));
}

/** Texte alternatif par defaut, jamais vide (exigence 10.3). */
export function altParDefaut(
  marque: string,
  modele: string,
  annee: number,
  vue: Vue,
  libelleVue: string
): string {
  return `${marque} ${modele} ${annee} - ${libelleVue}`.trim() || `${marque} ${modele} ${vue}`;
}

/**
 * Nom du fichier rapporté par un téléchargement. Il se lit dans une pellicule
 * de téléphone, où les photos de plusieurs motos se mélangent vite : la
 * référence d'abord, puisque c'est elle qui relie le fichier à la fiche, la
 * moto ensuite pour la reconnaître sans l'ouvrir, le rang enfin pour garder
 * l'ordre de la galerie. Sans extension : Cloudinary ajoute celle du format
 * qu'il livre.
 */
export function nomTelechargement(
  reference: string,
  marque: string,
  modele: string,
  ordre: number
): string {
  const base = slugifier(`${reference} ${marque} ${modele}`);
  return `${base}-${String(ordre).padStart(2, "0")}`;
}
