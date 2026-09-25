import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motoSchema } from "@/lib/schemas";
import { etatLot } from "@/lib/types";
import type { Media, Moto } from "@/lib/types";
import type { Pilote } from "@/lib/db/types";

/**
 * Le 25/09/2026, le même dossier de photos est parti deux fois. Chaque place
 * `(moto, ordre)` étant prise, le second envoi a été rangé à la suite : huit
 * fiches publiées montraient chaque photo en double. Un fichier nommé
 * `MI-058_03_34ad` désigne une place ; le renvoyer ne doit rien créer.
 */
const fichier = path.join(os.tmpdir(), `moto-import-double-envoi-${process.pid}.json`);
let pilote: Pilote;
let fiche: Moto;

const photo = (ordre: number, id: string): Omit<Media, "id" | "created_at"> => ({
  moto_id: fiche.id,
  type: "photo",
  origine: "reelle",
  vue: "autre",
  cloudinary_id: id,
  largeur: 1600,
  hauteur: 1200,
  blurhash: null,
  ordre,
  legende: null,
  alt: "photo",
  date_prise: null,
  lot_id: null,
});

beforeAll(async () => {
  process.env.LOCAL_DB_PATH = fichier;
  const { creerPiloteLocal } = await import("@/lib/db/local");
  pilote = creerPiloteLocal();
  fiche = await pilote.creerMoto(
    motoSchema.parse({
      reference: "MI-901",
      marque: "Kawasaki",
      modele: "Z900",
      annee: 2021,
      cylindree: 948,
      categorie: "roadster",
      etat: "neuf",
      statut: "brouillon",
      prix_ttc: 30_000_000,
      prix_yuan: 34_800,
      taux_yuan: 670,
      acompte_pct: 55,
      prix_valable_jusqu_au: "2027-02-25",
    })
  );
});

afterAll(async () => {
  await fs.rm(fichier, { force: true });
});

describe("double envoi d'un lot de photos", () => {
  it("ignore une photo nommée dont la place est déjà prise", async () => {
    await pilote.ajouterMedias([photo(1, "a1"), photo(2, "a2")], undefined, { siOrdrePris: "ignorer" });
    const second = await pilote.ajouterMedias([photo(1, "b1"), photo(2, "b2"), photo(3, "b3")], undefined, {
      siOrdrePris: "ignorer",
    });

    expect(second.map((m) => m.cloudinary_id)).toEqual(["b3"]);
    const toutes = await pilote.mediasDeMoto(fiche.id);
    expect(toutes.map((m) => [m.ordre, m.cloudinary_id])).toEqual([
      [1, "a1"],
      [2, "a2"],
      [3, "b3"],
    ]);
  });

  it("range toujours à la suite un ajout depuis la fiche", async () => {
    const ajout = await pilote.ajouterMedias([photo(1, "c1")]);
    expect(ajout[0].ordre).toBe(4);
  });
});

describe("état d'un lot dans l'historique", () => {
  const lot = { type: "medias_masse" as const, total: 131, reussis: 131, echoues: 0, rapport: null };

  it("dit interrompu un lot coupé avant son bilan", () => {
    expect(etatLot({ ...lot, reussis: 0 })).toBe("interrompu");
  });

  it("compte les photos déjà en ligne comme traitées", () => {
    const deja_presents = Array.from({ length: 31 }, (_, i) => `x${i}`);
    expect(etatLot({ ...lot, reussis: 100, rapport: { deja_presents } })).toBe("ok");
  });

  it("garde « avec échecs » et « OK » pour les lots complets", () => {
    expect(etatLot(lot)).toBe("ok");
    expect(etatLot({ ...lot, reussis: 130, echoues: 1 })).toBe("echecs");
  });
});
