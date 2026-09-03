const FINE = " "; // espace fine insécable
const NBSP = " "; // espace insécable

/** 12500000 -> "12 500 000 Ar" (fines insécables + NBSP avant l'unité) */
export const ar = (n: number): string =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, FINE) + NBSP + "Ar";

export const arCourt = (n: number): string => {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const s = Number.isInteger(m) ? String(m) : m.toFixed(1).replace(".", ",");
    return `${s}${NBSP}M${NBSP}Ar`;
  }
  return ar(n);
};

export const dateFr = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00Z" : d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(date.getUTCDate())}/${p(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
};

export const slugifier = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** slug = marque-modele-annee-reference (MI-047 -> mi047) */
export const construireSlug = (
  marque: string,
  modele: string,
  annee: number,
  reference: string
): string => slugifier(`${marque} ${modele} ${annee} ${reference.replace(/-/g, "")}`);

export const compterMots = (texte: string): number =>
  texte.trim().split(/\s+/).filter(Boolean).length;

export const joursAvant = (dateIso: string): number => {
  const cible = new Date(dateIso.length === 10 ? dateIso + "T00:00:00Z" : dateIso);
  const auj = new Date();
  const ajUtc = Date.UTC(auj.getUTCFullYear(), auj.getUTCMonth(), auj.getUTCDate());
  return Math.round((cible.getTime() - ajUtc) / 86_400_000);
};

export const telLisible = (t: string): string => t.replace(/[^\d+]/g, "");

/** Fenetre pendant laquelle une fiche est signalee comme nouvelle. */
export const FENETRE_NOUVEAUTE_MS = 24 * 60 * 60 * 1000;

/**
 * Vrai pendant les vingt-quatre heures qui suivent la mise en ligne. Le
 * bandeau « Nouveau » n'a donc rien a effacer : il cesse de s'afficher de
 * lui-meme des que la fiche depasse un jour.
 */
export const estNouvelle = (creeLe: string | null | undefined, maintenant = Date.now()): boolean => {
  if (!creeLe) return false;
  const t = new Date(creeLe).getTime();
  if (Number.isNaN(t)) return false;
  const age = maintenant - t;
  return age >= 0 && age < FENETRE_NOUVEAUTE_MS;
};
