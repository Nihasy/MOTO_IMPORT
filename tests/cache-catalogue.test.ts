import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motoSchema } from "@/lib/schemas";
import type { Pilote } from "@/lib/db/types";

/**
 * Le catalogue public se lit en cache, par morceaux : les fiches d'un côté,
 * les photos de l'autre (`lib/catalogue-public.ts`). Ces deux lectures doivent
 * redonner exactement ce que `listerMotosPubliques` donnait d'un bloc, et le
 * pilote qui vide le cache après chaque écriture ne doit rien casser hors du
 * serveur de rendu — scripts et tests passent par lui aussi.
 */
const fichier = path.join(os.tmpdir(), `moto-import-cache-${process.pid}.json`);
let pilote: Pilote;

const fiche = (reference: string, statut: string) =>
  motoSchema.parse({
    reference, marque: "Honda", modele: `CB ${reference}`, annee: 2023, cylindree: 471,
    categorie: "trail", etat: "neuf", statut, prix_ttc: 15_000_000, prix_yuan: 15_000, taux_yuan: 670,
    acompte_pct: 65, prix_valable_jusqu_au: "2026-12-31", description: "Essai.",
    volume_m3: 1.2, marge_ar: 3_000_000,
  });

const photo = (moto_id: string, ordre: number) => ({
  moto_id, type: "photo" as const, origine: "reelle" as const, vue: "autre" as const,
  cloudinary_id: `moto-import/essai/${moto_id}-${ordre}`, largeur: 1440, hauteur: 1080,
  blurhash: null, ordre, legende: null, alt: `Photo ${ordre}`, date_prise: null,
});

beforeAll(async () => {
  // Le chemin est lu au chargement du module : il doit être posé avant l'import.
  process.env.LOCAL_DB_PATH = fichier;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
  const { db, reinitialiserPilote } = await import("@/lib/db");
  reinitialiserPilote();
  pilote = db();
});

afterAll(async () => {
  await fs.rm(fichier, { force: true });
});

describe("pilote qui vide le cache du catalogue", () => {
  it("écrit sans erreur hors du serveur de rendu, et renvoie le résultat de l'écriture", async () => {
    expect(pilote.nom).toBe("local");
    const a = await pilote.creerMoto(fiche("MI-501", "disponible"));
    const b = await pilote.creerMoto(fiche("MI-502", "reserve"));
    const c = await pilote.creerMoto(fiche("MI-503", "brouillon"));
    expect(a.reference).toBe("MI-501");

    const posees = await pilote.ajouterMedias([photo(a.id, 0), photo(a.id, 1), photo(a.id, 2), photo(b.id, 0), photo(c.id, 0)]);
    expect(posees).toHaveLength(5);

    const maj = await pilote.majMoto(a.id, { prix_ttc: 16_000_000 });
    expect(maj.prix_ttc).toBe(16_000_000);
    expect((await pilote.majStatut(b.id, "vendu")).statut).toBe("vendu");
  });

  it("garde les lectures intactes", async () => {
    expect((await pilote.listerMotosAdmin()).map((m) => m.reference).sort()).toEqual(["MI-501", "MI-502", "MI-503"]);
  });
});

describe("catalogue lu par morceaux", () => {
  it("les fiches publiques excluent le brouillon et ne portent rien d'interne", async () => {
    const fiches = await pilote.listerFichesPubliques();
    expect(fiches.map((m) => m.reference).sort()).toEqual(["MI-501", "MI-502"]);
    for (const m of fiches) {
      for (const interne of ["prix_yuan", "taux_yuan", "volume_m3", "marge_ar", "fournisseur_id", "medias"]) {
        expect(Object.keys(m), interne).not.toContain(interne);
      }
    }
  });

  it("fiches + photos recomposent exactement la lecture d'un bloc", async () => {
    const bloc = await pilote.listerMotosPubliques();
    const fiches = await pilote.listerFichesPubliques();
    const medias = await pilote.mediasDeMotos(fiches.map((m) => m.id));
    expect(fiches.map((m) => ({ ...m, medias: medias[m.id] ?? [] }))).toEqual(bloc);
  });

  it("les photos sortent dans l'ordre, moto par moto, et rien pour une moto inconnue", async () => {
    const [a] = (await pilote.listerFichesPubliques()).filter((m) => m.reference === "MI-501");
    const medias = await pilote.mediasDeMotos([a.id, "00000000-0000-0000-0000-000000000000"]);
    expect(Object.keys(medias)).toEqual([a.id]);
    expect(medias[a.id].map((m) => m.ordre)).toEqual([0, 1, 2]);
    expect(await pilote.mediasDeMotos([])).toEqual({});
  });
});
