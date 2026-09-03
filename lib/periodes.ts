export const PERIODES = {
  tout: "Depuis toujours",
  "7j": "7 jours",
  "30j": "30 jours",
  mois: "Ce mois-ci",
} as const;

export type Periode = keyof typeof PERIODES;

export const estPeriode = (v: string | undefined): v is Periode => Boolean(v && v in PERIODES);

const JOUR_MS = 86_400_000;

/**
 * Madagascar est à UTC+3 toute l'année, sans heure d'été.
 *
 * Le décalage est explicite parce que le serveur, lui, tourne en UTC :
 * `setHours(0,0,0,0)` y donnait minuit UTC, soit trois heures du matin à
 * Antananarivo. Une demande reçue entre minuit et trois heures le 1er du mois
 * était comptée sur le mois précédent — et le compteur « contrats signés ce
 * mois », qui décide de l'avenir du projet (3), s'en trouvait faux.
 */
const DECALAGE_TANA_MS = 3 * 60 * 60 * 1000;

/** Minuit, heure d'Antananarivo, le premier jour du mois en cours. */
export function debutDuMoisTana(maintenant = new Date()): Date {
  const tana = new Date(maintenant.getTime() + DECALAGE_TANA_MS);
  const premier = Date.UTC(tana.getUTCFullYear(), tana.getUTCMonth(), 1);
  return new Date(premier - DECALAGE_TANA_MS);
}

/**
 * Borne basse d'une période, ou `null` pour « depuis toujours ».
 *
 * `maintenant` est un paramètre pour que le calcul soit testable : une borne
 * calculée sur l'horloge système ne se vérifie pas.
 */
export function debutPeriode(periode: Periode, maintenant = new Date()): Date | null {
  switch (periode) {
    case "7j":
      return new Date(maintenant.getTime() - 7 * JOUR_MS);
    case "30j":
      return new Date(maintenant.getTime() - 30 * JOUR_MS);
    case "mois":
      return debutDuMoisTana(maintenant);
    default:
      return null;
  }
}

export function dansPeriode(
  dateIso: string,
  periode: Periode,
  maintenant = new Date()
): boolean {
  const debut = debutPeriode(periode, maintenant);
  if (!debut) return true;
  const t = new Date(dateIso).getTime();
  return Number.isFinite(t) && t >= debut.getTime();
}
