import { describe, expect, it } from "vitest";
import { analyserCsvMotos } from "@/lib/import-csv";
import { CSV_MODELE, parserCsv, versCsv } from "@/lib/csv";

const ENTETE =
  "reference,marque,modele,annee,cylindree,categorie,etat,kilometrage,prix_ttc,prix_valable_jusqu_au,description,points_forts,fournisseur,statut,date_photos,abs";

const ligne = (o: Partial<Record<string, string>> = {}) =>
  [
    o.reference ?? "MI-101",
    o.marque ?? "Honda",
    o.modele ?? "CB500X",
    o.annee ?? "2023",
    o.cylindree ?? "471",
    o.categorie ?? "trail",
    o.etat ?? "neuf",
    o.kilometrage ?? "",
    o.prix_ttc ?? "14500000",
    o.prix_valable_jusqu_au ?? "2026-12-31",
    o.description ?? "Trail routier polyvalent.",
    o.points_forts ?? "ABS|Selle basse",
    o.fournisseur ?? "Guangzhou Moto",
    o.statut ?? "disponible",
    o.date_photos ?? "",
    o.abs ?? "true",
  ].join(",");

describe("analyseur CSV", () => {
  it("lit les guillemets et les virgules encadrées", () => {
    const { lignes } = parserCsv('a,b\n"un, deux",trois');
    expect(lignes[0]).toEqual({ a: "un, deux", b: "trois" });
  });

  it("gère les guillemets échappés", () => {
    const { lignes } = parserCsv('a\n"il dit ""oui"""');
    expect(lignes[0].a).toBe('il dit "oui"');
  });

  it("ignore le BOM et les lignes vides", () => {
    const { entetes, lignes } = parserCsv("﻿a,b\n1,2\n\n");
    expect(entetes).toEqual(["a", "b"]);
    expect(lignes).toHaveLength(1);
  });

  it("fait un aller-retour avec versCsv", () => {
    const source = [{ a: "un, deux", b: 'guillemet "x"' }];
    expect(parserCsv(versCsv(source)).lignes[0]).toEqual({ a: "un, deux", b: 'guillemet "x"' });
  });
});

describe("import CSV des motos (7.4)", () => {
  it("accepte un fichier valide et découpe les points forts sur |", () => {
    const r = analyserCsvMotos(`${ENTETE}\n${ligne()}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos).toHaveLength(1);
    expect(r.motos[0].points_forts).toEqual(["ABS", "Selle basse"]);
    expect(r.motos[0].fournisseur).toBe("Guangzhou Moto");
    expect(r.motos[0].abs).toBe(true);
  });

  it("valide le modèle CSV téléchargeable fourni à l'utilisateur", () => {
    expect(analyserCsvMotos(CSV_MODELE).ok).toBe(true);
  });

  it("rejette INTÉGRALEMENT le fichier si une seule ligne est invalide", () => {
    const csv = [ENTETE, ligne(), ligne({ reference: "MI-102", prix_ttc: "zero" }), ligne({ reference: "MI-103" })].join("\n");
    const r = analyserCsvMotos(csv);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.total).toBe(3);
    expect(r.erreurs[0].ligne).toBe(3);
    expect(r.erreurs[0].colonne).toBe("prix_ttc");
  });

  it("indique la ligne et la colonne fautives", () => {
    const r = analyserCsvMotos(`${ENTETE}\n${ligne({ reference: "XX-1" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[0]).toMatchObject({ ligne: 2, colonne: "reference" });
    expect(r.erreurs[0].message).toMatch(/MI-047/);
  });

  it("exige le kilométrage pour une occasion", () => {
    const r = analyserCsvMotos(`${ENTETE}\n${ligne({ etat: "occasion", date_photos: "2026-01-10" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.some((e) => e.colonne === "kilometrage")).toBe(true);
  });

  it("exige la date de photos pour une occasion (CGV art. 3.4)", () => {
    const r = analyserCsvMotos(`${ENTETE}\n${ligne({ etat: "occasion", kilometrage: "18400" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.some((e) => e.colonne === "date_photos")).toBe(true);
  });

  it("accepte une occasion complète", () => {
    const r = analyserCsvMotos(
      `${ENTETE}\n${ligne({ etat: "occasion", kilometrage: "18400", date_photos: "2026-01-10" })}`
    );
    expect(r.ok).toBe(true);
  });

  it("refuse deux fois la même référence dans un même fichier", () => {
    const r = analyserCsvMotos(`${ENTETE}\n${ligne()}\n${ligne()}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[0].colonne).toBe("reference");
    expect(r.erreurs[0].message).toMatch(/ligne 2/);
  });

  it("refuse un fichier auquel il manque une colonne obligatoire", () => {
    const r = analyserCsvMotos("reference,marque\nMI-101,Honda");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.map((e) => e.colonne)).toContain("prix_ttc");
  });

  it("refuse un fichier sans aucune ligne de données", () => {
    expect(analyserCsvMotos(ENTETE).ok).toBe(false);
  });

  it("refuse une catégorie hors énumération", () => {
    const r = analyserCsvMotos(`${ENTETE}\n${ligne({ categorie: "quad" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[0].colonne).toBe("categorie");
  });
});
