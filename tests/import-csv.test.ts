import { describe, expect, it } from "vitest";
import { analyserCsvMotos } from "@/lib/import-csv";
import { CSV_MODELE, parserCsv, versCsv } from "@/lib/csv";
import { REGLAGES_DEFAUT } from "@/lib/tarification-defaut";

const analyser = (csv: string) => analyserCsvMotos(csv, REGLAGES_DEFAUT);

const ENTETE =
  "reference,marque,modele,annee,cylindree,categorie,etat,kilometrage,prix_yuan,prix_valable_jusqu_au,description,points_forts,fournisseur,statut,date_photos,abs";

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
    o.prix_yuan ?? "15000",
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
    const r = analyser(`${ENTETE}\n${ligne()}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos).toHaveLength(1);
    expect(r.motos[0].points_forts).toEqual(["ABS", "Selle basse"]);
    expect(r.motos[0].fournisseur).toBe("Guangzhou Moto");
    expect(r.motos[0].abs).toBe(true);
  });

  it("valide le modèle CSV téléchargeable fourni à l'utilisateur", () => {
    expect(analyser(CSV_MODELE).ok).toBe(true);
  });

  it("rejette INTÉGRALEMENT le fichier si une seule ligne est invalide", () => {
    const csv = [ENTETE, ligne(), ligne({ reference: "MI-102", prix_yuan: "zero" }), ligne({ reference: "MI-103" })].join("\n");
    const r = analyser(csv);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.total).toBe(3);
    expect(r.erreurs[0].ligne).toBe(3);
    expect(r.erreurs[0].colonne).toBe("prix_yuan");
  });

  it("indique la ligne et la colonne fautives", () => {
    const r = analyser(`${ENTETE}\n${ligne({ reference: "XX-1" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[0]).toMatchObject({ ligne: 2, colonne: "reference" });
    expect(r.erreurs[0].message).toMatch(/MI-047/);
  });

  it("exige le kilométrage pour une occasion", () => {
    const r = analyser(`${ENTETE}\n${ligne({ etat: "occasion", date_photos: "2026-01-10" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.some((e) => e.colonne === "kilometrage")).toBe(true);
  });

  it("exige la date de photos pour une occasion (CGV art. 3.4)", () => {
    const r = analyser(`${ENTETE}\n${ligne({ etat: "occasion", kilometrage: "18400" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.some((e) => e.colonne === "date_photos")).toBe(true);
  });

  it("accepte une occasion complète", () => {
    const r = analyser(
      `${ENTETE}\n${ligne({ etat: "occasion", kilometrage: "18400", date_photos: "2026-01-10" })}`
    );
    expect(r.ok).toBe(true);
  });

  it("refuse deux fois la même référence dans un même fichier", () => {
    const r = analyser(`${ENTETE}\n${ligne()}\n${ligne()}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[0].colonne).toBe("reference");
    expect(r.erreurs[0].message).toMatch(/ligne 2/);
  });

  it("refuse un fichier auquel il manque une colonne obligatoire", () => {
    const r = analyser("reference,marque\nMI-101,Honda");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs.map((e) => e.colonne)).toContain("prix_yuan");
  });

  it("accepte un fichier sans colonne description, et une description vide", () => {
    const sansColonne =
      "reference,marque,modele,annee,cylindree,categorie,etat,prix_yuan,prix_valable_jusqu_au\n" +
      "MI-102,Honda,CB500X,2023,471,trail,neuf,15000,2026-12-31";
    const r = analyser(sansColonne);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos[0].description).toBe("");

    const celluleVide = analyser(`${ENTETE}\n${ligne({ description: "" })}`);
    expect(celluleVide.ok).toBe(true);
  });

  it("refuse un fichier sans aucune ligne de données", () => {
    expect(analyser(ENTETE).ok).toBe(false);
  });

  it("refuse une catégorie hors énumération", () => {
    const r = analyser(`${ENTETE}\n${ligne({ categorie: "quad" })}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[0].colonne).toBe("categorie");
  });
});

describe("prix calculés à l'import", () => {
  it("calcule le prix de vente et l'acompte depuis le prix en yuan", () => {
    const r = analyser(`${ENTETE}
${ligne({ prix_yuan: "15000" })}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos[0]).toMatchObject({ prix_yuan: 15_000, prix_ttc: 18_100_000, acompte_pct: 60, taux_yuan: 670 });
  });

  it("accepte les séparateurs de milliers dans le prix en yuan", () => {
    const r = analyser(`${ENTETE}
${ligne({ prix_yuan: "15 000" })}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos[0].prix_yuan).toBe(15_000);
  });

  it("importe sans prix une ligne au prix en yuan vide", () => {
    const r = analyser(`${ENTETE}
${ligne({ prix_yuan: "" })}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos[0]).toMatchObject({ prix_ttc: 0, prix_yuan: null, acompte_pct: null });
  });

  it("n'accepte plus de prix de vente saisi : la colonne prix_ttc est ignorée", () => {
    const csv =
      "reference,marque,modele,annee,cylindree,categorie,etat,prix_ttc,prix_yuan,prix_valable_jusqu_au\n" +
      "MI-102,Honda,CB500X,2023,471,trail,neuf,1000,15000,2026-12-31";
    const r = analyser(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos[0].prix_ttc).toBe(18_100_000);
  });
});
