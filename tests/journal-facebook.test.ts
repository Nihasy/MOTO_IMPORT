import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pilote } from "@/lib/db/types";

/**
 * Journal des publications Facebook sur le magasin local. Un magasin écrit avant
 * le Studio n'a pas de liste `publications_fb` : il doit la créer au premier
 * passage, sans rien perdre du reste.
 */
const fichier = path.join(os.tmpdir(), `moto-import-journal-fb-${process.pid}.json`);
let pilote: Pilote;

beforeAll(async () => {
  await fs.writeFile(
    fichier,
    JSON.stringify({ motos: [], medias: [], demandes: [], fournisseurs: [], import_lots: [] }),
    "utf8"
  );
  // Le chemin est lu au chargement du module : il doit être posé avant l'import.
  process.env.LOCAL_DB_PATH = fichier;
  const { creerPiloteLocal } = await import("@/lib/db/local");
  pilote = creerPiloteLocal();
});

afterAll(async () => {
  await fs.rm(fichier, { force: true });
});

describe("journal des publications Facebook (magasin local)", () => {
  it("part vide sur un magasin d'avant le Studio", async () => {
    expect(await pilote.listerPublicationsFb()).toEqual([]);
  });

  it("consigne, liste la plus récente d'abord, et note les ventes annoncées", async () => {
    const base = {
      mode: "direct" as const,
      post_id: "1_2",
      lien_post: "https://www.facebook.com/1_2",
      programme_pour: null,
      titre: "Roadsters",
      message: "Post",
      refs: ["MI-001", "MI-002"],
      ventes_signalees: [],
      auteur: "test",
    };
    const a = await pilote.creerPublicationFb(base);
    await new Promise((r) => setTimeout(r, 5));
    const b = await pilote.creerPublicationFb({ ...base, mode: "manuel", post_id: null, titre: "Trails" });

    expect((await pilote.listerPublicationsFb()).map((p) => p.id)).toEqual([b.id, a.id]);

    const maj = await pilote.majPublicationFb(a.id, { ventes_signalees: ["MI-002"] });
    expect(maj.ventes_signalees).toEqual(["MI-002"]);
    expect(maj.refs).toEqual(["MI-001", "MI-002"]);

    await expect(pilote.majPublicationFb("inconnue", {})).rejects.toThrow(/introuvable/);
  });
});
