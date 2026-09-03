import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Media, Moto, MotoAvecMedias, Statut } from "@/lib/types";
import { STATUTS_PUBLICS } from "@/lib/types";
import { construireSlug } from "@/lib/format";
import type { FiltresCatalogue, Pilote } from "./types";
import { publier } from "./types";
import { appliquerFiltres, similaires, trierCatalogue } from "./filtres";

/**
 * Colonnes exposées au public. `fournisseur_id` en est volontairement absent :
 * c'est la première des deux mesures du chapitre 12.2.
 */
const COLONNES_PUBLIQUES = [
  "id", "reference", "slug", "marque", "modele", "annee", "cylindree", "categorie",
  "etat", "statut", "kilometrage", "couleur", "puissance_ch", "poids_kg",
  "hauteur_selle_mm", "refroidissement", "transmission", "abs", "prix_ttc",
  "prix_valable_jusqu_au", "delai_min_jours", "delai_max_jours", "garantie_mois",
  "garantie_texte", "description", "points_forts", "etat_details", "date_photos",
  "date_vente", "vues", "created_at", "updated_at",
].join(", ");

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, cle, { auth: { persistSession: false } });
}

const err = (e: { message: string } | null) => {
  if (e) throw new Error(e.message);
};

export function creerPiloteSupabase(): Pilote {
  const sb = service();

  const mediasDe = async (ids: string[]): Promise<Record<string, Media[]>> => {
    if (!ids.length) return {};
    const { data, error } = await sb.from("medias").select("*").in("moto_id", ids).order("ordre");
    err(error);
    const parMoto: Record<string, Media[]> = {};
    for (const m of (data ?? []) as Media[]) (parMoto[m.moto_id] ??= []).push(m);
    return parMoto;
  };

  const publiquesAvecMedias = async (f: FiltresCatalogue = {}): Promise<MotoAvecMedias[]> => {
    const { data, error } = await sb
      .from("motos_publiques")
      .select(COLONNES_PUBLIQUES)
      .in("statut", [...STATUTS_PUBLICS]);
    err(error);
    const motos = trierCatalogue(appliquerFiltres((data ?? []) as unknown as Moto[], f));
    const medias = await mediasDe(motos.map((m) => m.id));
    return motos.map((m) => ({ ...publier(m), medias: medias[m.id] ?? [] }));
  };

  return {
    nom: "supabase",

    listerMotosPubliques: publiquesAvecMedias,

    async motoParSlug(slug) {
      const { data, error } = await sb
        .from("motos_publiques")
        .select(COLONNES_PUBLIQUES)
        .eq("slug", slug)
        .in("statut", [...STATUTS_PUBLICS])
        .maybeSingle();
      err(error);
      if (!data) return null;
      const moto = data as unknown as Moto;
      const medias = await mediasDe([moto.id]);
      return { ...publier(moto), medias: medias[moto.id] ?? [] };
    },

    async motosSimilaires(slug, n) {
      const toutes = await publiquesAvecMedias();
      const ref = toutes.find((m) => m.slug === slug);
      return ref ? similaires(toutes, ref, n) : [];
    },

    async slugsPublies() {
      const { data, error } = await sb
        .from("motos_publiques")
        .select("slug, updated_at")
        .in("statut", [...STATUTS_PUBLICS]);
      err(error);
      return (data ?? []) as { slug: string; updated_at: string }[];
    },

    async incrementerVues(id) {
      await sb.rpc("incrementer_vues", { moto: id });
    },

    async listerMotosAdmin() {
      const { data, error } = await sb.from("motos").select("*").order("updated_at", { ascending: false });
      err(error);
      const motos = (data ?? []) as Moto[];
      const medias = await mediasDe(motos.map((m) => m.id));
      return motos.map((m) => {
        const siennes = medias[m.id] ?? [];
        return { ...m, nb_photos: siennes.length, couverture: siennes[0] ?? null };
      });
    },

    async motoParId(id) {
      const { data, error } = await sb.from("motos").select("*").eq("id", id).maybeSingle();
      err(error);
      return (data as Moto) ?? null;
    },

    async motoParReference(ref) {
      const { data, error } = await sb.from("motos").select("*").eq("reference", ref).maybeSingle();
      err(error);
      return (data as Moto) ?? null;
    },

    async creerMoto(input) {
      const ligne = {
        ...input,
        slug: construireSlug(input.marque, input.modele, input.annee, input.reference),
      };
      const { data, error } = await sb.from("motos").insert(ligne).select().single();
      err(error);
      return data as Moto;
    },

    async enregistrerParReference(input) {
      // `upsert` sur la contrainte unique de `reference` : c'est PostgreSQL
      // qui arbitre, donc aucune fenetre entre la lecture et l'ecriture.
      const avant = await sb.from("motos").select("id").eq("reference", input.reference).maybeSingle();
      const ligne = {
        ...input,
        slug: construireSlug(input.marque, input.modele, input.annee, input.reference),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await sb
        .from("motos")
        .upsert(ligne, { onConflict: "reference" })
        .select()
        .single();
      err(error);
      return { moto: data as Moto, cree: !avant.data };
    },

    async majMoto(id, input) {
      const patch: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() };
      if (input.marque && input.modele && input.annee && input.reference) {
        patch.slug = construireSlug(input.marque, input.modele, input.annee, input.reference);
      }
      const { data, error } = await sb.from("motos").update(patch).eq("id", id).select().single();
      err(error);
      return data as Moto;
    },

    async majStatut(id, statut: Statut) {
      const patch: Record<string, unknown> = { statut, updated_at: new Date().toISOString() };
      patch.date_vente = statut === "vendu" ? new Date().toISOString().slice(0, 10) : null;
      const { data, error } = await sb.from("motos").update(patch).eq("id", id).select().single();
      err(error);
      return data as Moto;
    },

    async supprimerMoto(id) {
      err((await sb.from("motos").delete().eq("id", id)).error);
    },

    async mediasDeMoto(motoId) {
      const { data, error } = await sb.from("medias").select("*").eq("moto_id", motoId).order("ordre");
      err(error);
      return (data ?? []) as Media[];
    },

    async ajouterMedias(medias, lotId) {
      const lignes = medias.map((m) => ({ ...m, lot_id: lotId ?? null }));
      const { data, error } = await sb.from("medias").insert(lignes).select();
      err(error);
      return (data ?? []) as Media[];
    },

    async majMedia(id, patch) {
      const { data, error } = await sb.from("medias").update(patch).eq("id", id).select().single();
      err(error);
      return data as Media;
    },

    async supprimerMedia(id) {
      err((await sb.from("medias").delete().eq("id", id)).error);
    },

    async reordonnerMedias(motoId, ordre) {
      // Décalage temporaire pour ne pas violer unique(moto_id, ordre).
      for (let i = 0; i < ordre.length; i++) {
        err((await sb.from("medias").update({ ordre: -(i + 1) }).eq("id", ordre[i]).eq("moto_id", motoId)).error);
      }
      for (let i = 0; i < ordre.length; i++) {
        err((await sb.from("medias").update({ ordre: i + 1 }).eq("id", ordre[i]).eq("moto_id", motoId)).error);
      }
    },

    async creerDemande(d) {
      const { data, error } = await sb.from("demandes").insert(d).select().single();
      err(error);
      return data as import("@/lib/types").Demande;
    },

    async listerDemandes() {
      const { data, error } = await sb.from("demandes").select("*").order("created_at", { ascending: false });
      err(error);
      return (data ?? []) as import("@/lib/types").Demande[];
    },

    async majDemande(id, patch) {
      const { data, error } = await sb
        .from("demandes")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      err(error);
      return data as import("@/lib/types").Demande;
    },

    async listerFournisseurs() {
      const { data, error } = await sb.from("fournisseurs").select("*").order("nom");
      err(error);
      const fournisseurs = (data ?? []) as import("@/lib/types").Fournisseur[];
      const { data: motos } = await sb.from("motos").select("fournisseur_id");
      return fournisseurs.map((f) => ({
        ...f,
        nb_motos: (motos ?? []).filter((m: { fournisseur_id: string | null }) => m.fournisseur_id === f.id).length,
      }));
    },

    async fournisseurParNom(nom) {
      const { data, error } = await sb.from("fournisseurs").select("*").ilike("nom", nom).maybeSingle();
      err(error);
      return (data as import("@/lib/types").Fournisseur) ?? null;
    },

    async creerFournisseur(f) {
      const { data, error } = await sb.from("fournisseurs").insert(f).select().single();
      err(error);
      return data as import("@/lib/types").Fournisseur;
    },

    async majFournisseur(id, patch) {
      const { data, error } = await sb.from("fournisseurs").update(patch).eq("id", id).select().single();
      err(error);
      return data as import("@/lib/types").Fournisseur;
    },

    async supprimerFournisseur(id) {
      err((await sb.from("fournisseurs").delete().eq("id", id)).error);
    },

    async creerLot(lot) {
      const { data, error } = await sb.from("import_lots").insert(lot).select().single();
      err(error);
      return data as import("@/lib/types").ImportLot;
    },

    async majLot(id, patch) {
      const { data, error } = await sb.from("import_lots").update(patch).eq("id", id).select().single();
      err(error);
      return data as import("@/lib/types").ImportLot;
    },

    async listerLots() {
      const { data, error } = await sb.from("import_lots").select("*").order("created_at", { ascending: false });
      err(error);
      return (data ?? []) as import("@/lib/types").ImportLot[];
    },

    async annulerLot(id) {
      const { data } = await sb.from("medias").select("id").eq("lot_id", id);
      const n = (data ?? []).length;
      err((await sb.from("medias").delete().eq("lot_id", id)).error);
      err((await sb.from("import_lots").delete().eq("id", id)).error);
      return n;
    },
  };
}
