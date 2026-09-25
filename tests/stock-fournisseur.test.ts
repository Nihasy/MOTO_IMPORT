import { describe, expect, it } from "vitest";
import { descriptionCourte, motosDuStock } from "@/lib/stock-fournisseur";
import { trierCatalogue } from "@/lib/db/filtres";
import type { Moto } from "@/lib/types";

type Ligne = Pick<Moto, "fournisseur_id" | "statut" | "mise_en_vente" | "reference">;
const moto = (reference: string, p: Partial<Ligne> = {}): Ligne => ({
  reference,
  fournisseur_id: "f3",
  statut: "disponible",
  mise_en_vente: "commande",
  ...p,
});

describe("fiche de stock d'un fournisseur", () => {
  const motos = [
    moto("MI-070", { statut: "vendu" }),
    moto("MI-058"),
    moto("MI-066", { statut: "reserve" }),
    moto("MI-059", { statut: "brouillon" }),
    moto("MI-060", { statut: "dispo_immediate", mise_en_vente: "local" }),
    moto("MI-061", { statut: "archive" }),
    moto("MI-062", { fournisseur_id: "autre" }),
  ];

  it("ne garde que ses motos publiées sur commande, en vente d'abord", () => {
    expect(motosDuStock(motos, "f3").map((m) => [m.reference, m.statut])).toEqual([
      ["MI-058", "disponible"],
      ["MI-066", "reserve"],
      ["MI-070", "vendu"],
    ]);
  });

  it("écarte une moto vendue depuis le local", () => {
    const locale = moto("MI-071", { statut: "vendu", mise_en_vente: "local" });
    expect(motosDuStock([locale], "f3")).toEqual([]);
  });

  it("réduit la description à sa première phrase", () => {
    expect(descriptionCourte("Kawasaki Z900 de 2021, 19 000 km. Quatre-cylindres de 948 cm³.")).toBe(
      "Kawasaki Z900 de 2021, 19 000 km."
    );
    expect(descriptionCourte("a".repeat(200), 20)).toHaveLength(20);
  });
});

describe("fil public", () => {
  it("pousse les réservées puis les vendues en bas, quel que soit le tri", () => {
    const m = (reference: string, statut: Moto["statut"], prix_ttc: number) =>
      ({ reference, statut, prix_ttc, created_at: "2026-09-25", cylindree: 600, annee: 2021 }) as Moto & {
        medias: [];
      };
    const liste = [m("V", "vendu", 1), m("R", "reserve", 2), m("D", "disponible", 3)];
    expect(trierCatalogue(liste as never[], "prix", "asc").map((x: Moto) => x.reference)).toEqual(["D", "R", "V"]);
  });
});
