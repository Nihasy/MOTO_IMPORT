import type { Pilote } from "./types";
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
  instance = supabaseConfigure() ? creerPiloteSupabase() : creerPiloteLocal();
  return instance;
}

export function reinitialiserPilote() {
  instance = null;
}

export type { Pilote, FiltresCatalogue } from "./types";
