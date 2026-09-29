import { describe, expect, it } from "vitest";
import { immatriculable, mentionCarteGrise, phraseCarteGrise } from "@/lib/immatriculation";

describe("carte grise selon la catégorie (CGV 7.4)", () => {
  it("ne promet pas de carte grise pour une moto de cross", () => {
    const cross = { categorie: "motocross" as const };
    expect(immatriculable(cross)).toBe(false);
    expect(mentionCarteGrise(cross)).toBe("Hors route, sans carte grise");
    expect(phraseCarteGrise(cross)).toContain("sans carte grise");
  });

  it("garde la carte grise incluse pour les autres catégories, trail compris", () => {
    for (const categorie of ["trail", "routiere", "roadster", "sportive", "custom", "scooter"] as const) {
      expect(immatriculable({ categorie })).toBe(true);
      expect(phraseCarteGrise({ categorie })).toBe("Carte grise établie à votre nom, incluse.");
    }
  });
});
