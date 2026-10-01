import { revalidateTag } from "next/cache";
import type { Pilote } from "./types";
import { ETIQUETTE_CATALOGUE } from "./etiquettes";
import { creerPiloteLocal } from "./local";
import { creerPiloteSupabase } from "./supabase";

let instance: Pilote | null = null;

export function supabaseConfigure(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/**
 * Pilote de donnees. Supabase des que les variables d'environnement sont
 * fournies, magasin local JSON sinon, pour que le projet tourne sans configuration.
 */
export function db(): Pilote {
  if (instance) return instance;
  instance = viderCatalogueApresEcriture(supabaseConfigure() ? creerPiloteSupabase() : creerPiloteLocal());
  return instance;
}

/** Écritures qui changent ce que le catalogue public affiche. */
const ECRITURES_CATALOGUE = [
  "creerMoto", "enregistrerParReference", "majMoto", "majStatut", "supprimerMoto",
  "ajouterMedias", "majMedia", "supprimerMedia", "reordonnerMedias", "annulerLot",
] as const satisfies readonly (keyof Pilote)[];

/**
 * Vide le cache du catalogue public après chaque écriture qui le concerne.
 * Posé ici, sur le pilote, et non dans chaque action : une écriture ajoutée
 * demain qui oublierait de vider le cache laisserait un prix périmé en ligne
 * pendant une heure, sans que rien ne le signale.
 *
 * Hors du serveur de rendu (scripts, tests), `revalidateTag` n'a rien à vider
 * et lève une erreur : elle est ignorée.
 */
function viderCatalogueApresEcriture(pilote: Pilote): Pilote {
  const enveloppe = { ...pilote } as Record<string, unknown>;
  for (const nom of ECRITURES_CATALOGUE) {
    const ecrire = pilote[nom] as (...args: unknown[]) => Promise<unknown>;
    enveloppe[nom] = async (...args: unknown[]) => {
      const resultat = await ecrire(...args);
      try {
        revalidateTag(ETIQUETTE_CATALOGUE);
      } catch {
        /* pas de cache à vider hors du serveur de rendu */
      }
      return resultat;
    };
  }
  return enveloppe as unknown as Pilote;
}

export function reinitialiserPilote() {
  instance = null;
}

export type { Pilote, FiltresCatalogue } from "./types";
