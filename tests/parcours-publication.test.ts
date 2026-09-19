import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verrouPublication } from "@/lib/publication";
import { motoSchema } from "@/lib/schemas";
import { VUES_OBLIGATOIRES, altParDefaut } from "@/lib/medias";
import { LIBELLE_VUE } from "@/lib/types";
import type { Media, Moto } from "@/lib/types";
import type { Pilote } from "@/lib/db/types";

/**
 * Parcours réel de création d'une moto, du formulaire à la mise en vente.
 *
 * Les contrôles unitaires vivent ailleurs ; ce qui est éprouvé ici est leur
 * enchaînement, sur le magasin de données lui-même : une fiche naît sans photo
 * ni description, le verrou la retient tant qu'il manque quelque chose, et elle
 * rejoint le catalogue public dès que tout est là. C'est ce chaînage qui s'était
 * cassé, pas les règles prises une à une.
 */
const fichier = path.join(os.tmpdir(), `moto-import-parcours-${process.pid}.json`);
let pilote: Pilote;
let fiche: Moto;
let medias: Media[];

beforeAll(async () => {
  // Le chemin est lu au chargement du module : il doit être posé avant l'import.
  process.env.LOCAL_DB_PATH = fichier;
  const { creerPiloteLocal } = await import("@/lib/db/local");
  pilote = creerPiloteLocal();
});

afterAll(async () => {
  await fs.rm(fichier, { force: true });
});

describe("parcours de publication d'une moto (7.1, 10.3)", () => {
  it("crée la fiche en brouillon, sans description ni photo", async () => {
    // Exactement ce que le formulaire envoie : aucun statut, aucune description.
    const saisie = motoSchema.parse({
      reference: "MI-900",
      marque: "Honda",
      modele: "CB500X",
      annee: 2024,
      cylindree: 471,
      categorie: "trail",
      etat: "neuf",
      statut: "brouillon",
      prix_ttc: 14_500_000,
      prix_yuan: 12_000,
      taux_yuan: 670,
      acompte_pct: 55,
      prix_valable_jusqu_au: "2026-12-31",
    });

    fiche = await pilote.creerMoto(saisie);
    expect(fiche.statut).toBe("brouillon");
    expect(fiche.description).toBe("");
    expect(await pilote.mediasDeMoto(fiche.id)).toHaveLength(0);
  });

  it("refuse la mise en vente et nomme chaque point manquant", () => {
    const verrou = verrouPublication(fiche, [], "disponible");
    expect(verrou.autorise).toBe(false);
    const dit = verrou.bloquants.join(" · ");
    expect(dit).toMatch(/Photo de couverture/);
    expect(dit).toMatch(/Plan de prise de vue/);
    expect(dit).toMatch(/Description renseignée/);
    expect(dit).toMatch(/Garantie renseignée/);
  });

  it("laisse toujours enregistrer et archiver une fiche incomplète", () => {
    expect(verrouPublication(fiche, [], "brouillon").autorise).toBe(true);
    expect(verrouPublication(fiche, [], "archive").autorise).toBe(true);
    expect(verrouPublication(fiche, [], "vendu").autorise).toBe(true);
  });

  it("ouvre la vente une fois les photos, la description et la garantie en place", async () => {
    await pilote.ajouterMedias(
      VUES_OBLIGATOIRES.neuf.map((vue, i) => ({
        moto_id: fiche.id,
        type: "photo" as const,
        origine: "reelle" as const,
        vue,
        cloudinary_id: `test/${fiche.reference}-${i + 1}`,
        largeur: 1600,
        hauteur: 1200,
        blurhash: null,
        ordre: i + 1,
        legende: null,
        alt: altParDefaut("Honda", "CB500X", 2024, vue, LIBELLE_VUE[vue]),
        date_prise: null,
      }))
    );

    fiche = await pilote.majMoto(fiche.id, {
      description: "Trail routier, première main, prêt à prendre la route.",
      garantie_mois: 24,
      garantie_texte: "Moteur et boîte",
    });
    medias = await pilote.mediasDeMoto(fiche.id);

    const verrou = verrouPublication(fiche, medias, "disponible");
    expect(verrou.bloquants).toEqual([]);
    expect(verrou.autorise).toBe(true);
  });

  it("met la fiche au catalogue public une fois le statut basculé", async () => {
    fiche = await pilote.majStatut(fiche.id, "disponible");
    expect(fiche.statut).toBe("disponible");

    const catalogue = await pilote.listerMotosPubliques();
    expect(catalogue.map((m) => m.reference)).toContain("MI-900");

    const publique = await pilote.motoParSlug(fiche.slug);
    expect(publique?.medias).toHaveLength(VUES_OBLIGATOIRES.neuf.length);
    // Le fournisseur ne doit jamais sortir côté public (5.4).
    expect(publique && "fournisseur_id" in publique).toBe(false);
  });

  it("refuse de vider la description d'une fiche déjà en vente", () => {
    const appauvrie = { ...fiche, description: "" };
    const verrou = verrouPublication(appauvrie, medias, fiche.statut);
    expect(verrou.autorise).toBe(false);
    expect(verrou.bloquants.join(" ")).toMatch(/Description renseignée/);
  });

  it("laisse marquer vendue une fiche même devenue incomplète", () => {
    const appauvrie = { ...fiche, description: "" };
    expect(verrouPublication(appauvrie, medias, "vendu").autorise).toBe(true);
  });
});
