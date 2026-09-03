import { describe, expect, it } from "vitest";
import {
  altParDefaut, analyserNomFichier, grouperParReference, photosSuffisantes, vuesManquantes,
} from "@/lib/medias";

describe("convention de nommage (7.2)", () => {
  it("lit référence, ordre et code de vue", () => {
    const a = analyserNomFichier("MI-047_01_34ad.jpg");
    expect(a.valide).toBe(true);
    if (!a.valide) return;
    expect(a.reference).toBe("MI-047");
    expect(a.ordre).toBe(1);
    expect(a.vue).toBe("34_avant_droit");
    expect(a.origine).toBe("reelle");
  });

  it("reconnaît le compteur en position 5", () => {
    const a = analyserNomFichier("MI-047_05_cpt.jpg");
    expect(a.valide && a.vue).toBe("compteur");
  });

  it("bascule origine sur constructeur avec le suffixe -cat", () => {
    const a = analyserNomFichier("MI-051_01_34ad-cat.jpg");
    expect(a.valide && a.origine).toBe("constructeur");
    expect(a.valide && a.vue).toBe("34_avant_droit");
  });

  it("classe def1, def2… en point d'usure", () => {
    expect(analyserNomFichier("MI-047_11_def1.jpg")).toMatchObject({ valide: true, vue: "defaut", ordre: 11 });
    expect(analyserNomFichier("MI-047_12_def2.png")).toMatchObject({ valide: true, vue: "defaut" });
  });

  it("accepte les chemins complets et toutes les extensions supportées", () => {
    expect(analyserNomFichier("C:/lot/MI-047_02_pd.HEIC")).toMatchObject({ valide: true, vue: "profil_droit" });
    expect(analyserNomFichier("dossier/MI-047_03_34ag.webp")).toMatchObject({ valide: true });
  });

  it("rejette un nom illisible avec un motif explicite", () => {
    const a = analyserNomFichier("IMG_20240312_1423.jpg");
    expect(a.valide).toBe(false);
    if (a.valide) return;
    expect(a.motif).toMatch(/Nom illisible/);
  });

  it("rejette une extension non supportée", () => {
    expect(analyserNomFichier("MI-047_01_34ad.pdf")).toMatchObject({ valide: false });
  });

  it("classe un code inconnu en `autre` sans échouer", () => {
    expect(analyserNomFichier("MI-047_09_zzz.jpg")).toMatchObject({ valide: true, vue: "autre" });
  });
});

describe("regroupement par référence (7.3)", () => {
  const noms = [
    "MI-047_01_34ad.jpg", "MI-047_02_pd.jpg", "MI-047_03_34ag.jpg",
    "MI-051_01_34ad-cat.jpg", "MI-051_02_pd.jpg",
    "IMG_1234.jpg", "photo finale.png",
  ];

  it("groupe par référence et isole les orphelins", () => {
    const r = grouperParReference(noms);
    expect(r.groupes).toHaveLength(2);
    expect(r.groupes[0].reference).toBe("MI-047");
    expect(r.groupes[0].fichiers).toHaveLength(3);
    expect(r.groupes[1].reference).toBe("MI-051");
    expect(r.invalides).toHaveLength(2);
  });

  it("trie les fichiers par ordre croissant", () => {
    const r = grouperParReference(["MI-047_03_34ag.jpg", "MI-047_01_34ad.jpg", "MI-047_02_pd.jpg"]);
    expect(r.groupes[0].fichiers.map((f) => f.ordre)).toEqual([1, 2, 3]);
  });

  it("signale les ordres en doublon", () => {
    const r = grouperParReference(["MI-047_01_34ad.jpg", "MI-047_01_pd.jpg"]);
    expect(r.groupes[0].doublonsOrdre).toEqual([1]);
  });

  it("ne renvoie aucun groupe si tout est illisible", () => {
    const r = grouperParReference(["a.jpg", "b.jpg"]);
    expect(r.groupes).toHaveLength(0);
    expect(r.invalides).toHaveLength(2);
  });
});

describe("seuils de publication (7.1)", () => {
  it("exige 9 photos pour le neuf, 12 pour l'occasion", () => {
    expect(photosSuffisantes(9, "neuf")).toBe(true);
    expect(photosSuffisantes(8, "neuf")).toBe(false);
    expect(photosSuffisantes(12, "occasion")).toBe(true);
    expect(photosSuffisantes(11, "occasion")).toBe(false);
  });

  it("liste les vues manquantes du plan de prise de vue", () => {
    const medias = [{ vue: "34_avant_droit" as const }, { vue: "profil_droit" as const }];
    const manque = vuesManquantes(medias, "neuf");
    expect(manque).not.toContain("34_avant_droit");
    expect(manque).toContain("compteur");
    expect(vuesManquantes(medias, "occasion")).toContain("chassis");
  });
});

describe("texte alternatif", () => {
  it("n'est jamais vide", () => {
    expect(altParDefaut("Honda", "CB500X", 2021, "compteur", "Compteur")).toBe("Honda CB500X 2021 - Compteur");
  });
});
