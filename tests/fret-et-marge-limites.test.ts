import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculerPrix, erreurReglages, type Gabarit, type Reglages } from "@/lib/tarification";
import { REGLAGES_DEFAUT, completerReglages } from "@/lib/tarification-defaut";
import { analyserCsvMotos } from "@/lib/import-csv";
import { motoSchema } from "@/lib/schemas";
import { publier, type Pilote } from "@/lib/db/types";
import { ACOMPTE_MAX, ACOMPTE_MIN } from "@/lib/conditions";
import { CATEGORIES } from "@/lib/types";

/**
 * Cas limites du fret au volume et de la marge fixée à la main : les valeurs
 * au bord, celles qu'une faute de frappe produit, et ce qui ne doit jamais
 * sortir vers le public.
 */
const R = REGLAGES_DEFAUT;
const ROADSTER: Gabarit = { categorie: "roadster", cylindree: 650 };
const ENTETE = "reference;marque;modele;annee;cylindree;categorie;etat;prix_yuan;prix_valable_jusqu_au;volume_m3;marge_ar";
const ligne = (volume: string, marge: string, ref = "MI-101") =>
  `${ref};Honda;CB500X;2023;471;trail;neuf;15000;2026-12-31;${volume};${marge}`;
const analyser = (...lignes: string[]) => analyserCsvMotos([ENTETE, ...lignes].join("\n"), R);

describe("seuil de cylindrée", () => {
  it("bascule exactement au seuil, pas un centimètre cube avant", () => {
    const dossier = (cylindree: number) => calculerPrix(10_000, R, { categorie: "roadster", cylindree }).dossier_ar;
    expect(dossier(R.seuil_gros_cc - 1)).toBe(R.dossier_ar);
    expect(dossier(R.seuil_gros_cc)).toBe(R.dossier_gros_ar);
  });

  it("suit le seuil réglé", () => {
    const strict = { ...R, seuil_gros_cc: 1_000 };
    expect(calculerPrix(10_000, strict, { categorie: "sportive", cylindree: 999 }).dossier_ar).toBe(R.dossier_ar);
    expect(calculerPrix(10_000, strict, { categorie: "sportive", cylindree: 1_000 }).dossier_ar).toBe(R.dossier_gros_ar);
  });

  it("une cylindrée absente ou nulle prend le petit dossier, sans casser le calcul", () => {
    const c = calculerPrix(10_000, R, { categorie: "roadster", cylindree: 0 });
    expect(c.dossier_ar).toBe(R.dossier_ar);
    expect(Number.isFinite(c.prix_ar)).toBe(true);
  });
});

describe("volume au bord", () => {
  it("un volume nul sur la fiche vaut « pas de volume » : le standard s'applique", () => {
    expect(calculerPrix(10_000, R, { ...ROADSTER, volume_m3: 0 }).volume_m3).toBe(R.volumes_m3.roadster);
  });

  it("toutes les catégories ont un volume standard et donnent un prix fini", () => {
    for (const categorie of CATEGORIES) {
      const c = calculerPrix(10_000, R, { categorie, cylindree: 500 });
      expect(c.volume_m3, categorie).toBeGreaterThan(0);
      expect(Number.isFinite(c.prix_ar), categorie).toBe(true);
      expect(c.cout_ar, categorie).toBe(c.achat_ar + c.caisse_ar + c.transport_ar + c.dossier_ar);
    }
  });

  it("le prix croît avec le volume, sans jamais s'inverser", () => {
    let precedent = 0;
    for (let v = 0.3; v <= 3; v += 0.05) {
      const prix = calculerPrix(20_000, R, { ...ROADSTER, volume_m3: Math.round(v * 100) / 100 }).prix_ar;
      expect(prix).toBeGreaterThanOrEqual(precedent);
      precedent = prix;
    }
  });

  it("le schéma refuse un volume nul, négatif ou démesuré", () => {
    const base = {
      reference: "MI-101", marque: "Honda", modele: "CB500X", annee: 2023, cylindree: 471,
      categorie: "trail", etat: "neuf", prix_ttc: 0, prix_valable_jusqu_au: "2026-12-31",
    };
    expect(motoSchema.safeParse({ ...base, volume_m3: 1.42 }).success).toBe(true);
    expect(motoSchema.safeParse({ ...base, volume_m3: null }).success).toBe(true);
    expect(motoSchema.safeParse(base).success).toBe(true);
    for (const volume_m3 of [0, -1, 10.01, 142]) {
      expect(motoSchema.safeParse({ ...base, volume_m3 }).success, String(volume_m3)).toBe(false);
    }
  });

  it("le CSV refuse un volume nul, démesuré, négatif ou écrit en toutes lettres", () => {
    for (const volume of ["0", "142", "-1", "1,4 m3", "un"]) {
      const r = analyser(ligne(volume, ""));
      expect(r.ok, volume).toBe(false);
      if (!r.ok) expect(r.erreurs[0].colonne, volume).toBe("volume_m3");
    }
  });
});

describe("marge manuelle au bord", () => {
  it("un yuan de différence d'achat ne change pas la marge saisie", () => {
    const a = calculerPrix(20_000, { ...R, arrondi_ar: 1 }, { ...ROADSTER, marge_ar: 4_000_000 });
    const b = calculerPrix(20_001, { ...R, arrondi_ar: 1 }, { ...ROADSTER, marge_ar: 4_000_000 });
    expect(a.benefice_ar).toBe(4_000_000);
    expect(b.benefice_ar).toBe(4_000_000);
  });

  it("à prix coûtant sur une moto chère, plafonne l'acompte et chiffre le capital avancé", () => {
    const c = calculerPrix(80_000, R, { categorie: "sportive", cylindree: 1_103, marge_ar: 0 });
    expect(c.acompte_pct).toBe(ACOMPTE_MAX);
    expect(c.capital_avance_ar).toBe(c.achat_ar + c.caisse_ar - c.acompte_ar);
    expect(c.capital_avance_ar).toBeGreaterThan(0);
    expect(c.acompte_ar + c.solde_ar).toBe(c.prix_ar);
  });

  it("une très grosse marge sur une petite moto ramène l'acompte au plancher des CGV", () => {
    const c = calculerPrix(4_000, R, { categorie: "motocross", cylindree: 125, marge_ar: 20_000_000 });
    expect(c.acompte_pct).toBe(ACOMPTE_MIN);
    expect(c.capital_avance_ar).toBe(0);
  });

  it("le schéma refuse une marge négative, décimale ou démesurée", () => {
    const base = {
      reference: "MI-101", marque: "Honda", modele: "CB500X", annee: 2023, cylindree: 471,
      categorie: "trail", etat: "neuf", prix_ttc: 0, prix_valable_jusqu_au: "2026-12-31",
    };
    expect(motoSchema.safeParse({ ...base, marge_ar: 0 }).success).toBe(true);
    expect(motoSchema.safeParse({ ...base, marge_ar: null }).success).toBe(true);
    for (const marge_ar of [-1, 1.5, 1_000_000_001]) {
      expect(motoSchema.safeParse({ ...base, marge_ar }).success, String(marge_ar)).toBe(false);
    }
  });

  it("le CSV refuse une marge négative, décimale ou en toutes lettres", () => {
    for (const marge of ["-500000", "2,5", "2.5", "deux millions"]) {
      const r = analyser(ligne("", marge));
      expect(r.ok, marge).toBe(false);
      if (!r.ok) expect(r.erreurs[0].colonne, marge).toBe("marge_ar");
    }
  });

  it("volume et marge se cumulent sur la même ligne", () => {
    const r = analyser(ligne("1,42", "3000000"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const attendu = calculerPrix(15_000, R, { categorie: "trail", cylindree: 471, volume_m3: 1.42, marge_ar: 3_000_000 });
    expect(r.motos[0]).toMatchObject({ volume_m3: 1.42, marge_ar: 3_000_000, prix_ttc: attendu.prix_ar, acompte_pct: attendu.acompte_pct });
  });

  it("sans prix d'achat, la marge est gardée mais aucun prix n'est inventé", () => {
    const r = analyserCsvMotos(`${ENTETE}\nMI-101;Honda;CB500X;2023;471;trail;neuf;;2026-12-31;;3000000`, R);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos[0]).toMatchObject({ prix_ttc: 0, prix_yuan: null, marge_ar: 3_000_000 });
  });
});

describe("réglages au bord", () => {
  it("un fret à zéro dollar reste valide : seuls dossier et caisse comptent", () => {
    const r = { ...R, fret_usd_m3: 0 };
    expect(erreurReglages(r)).toBeNull();
    const c = calculerPrix(10_000, r, ROADSTER);
    expect(c.transport_ar).toBe(0);
    expect(c.fret_ar).toBe(R.dossier_ar);
  });

  it("une caisse à zéro yuan reste valide", () => {
    const r = { ...R, caisse_yuan: 0 };
    expect(erreurReglages(r)).toBeNull();
    expect(calculerPrix(10_000, r, ROADSTER).caisse_ar).toBe(0);
  });

  it("la caisse suit le taux du yuan, le fret celui du dollar", () => {
    const a = calculerPrix(10_000, R, ROADSTER);
    const yuan = calculerPrix(10_000, { ...R, taux_yuan: 700 }, ROADSTER);
    const dollar = calculerPrix(10_000, { ...R, taux_usd: 5_000 }, ROADSTER);
    expect(yuan.caisse_ar).toBe(300 * 700);
    expect(yuan.transport_ar).toBe(a.transport_ar);
    expect(dollar.transport_ar).toBe(Math.round(R.volumes_m3.roadster * 360 * 5_000));
    expect(dollar.caisse_ar).toBe(a.caisse_ar);
  });

  it("refuse un dollar tapé avec un chiffre en moins, un volume manquant, un seuil nul", () => {
    expect(erreurReglages({ ...R, taux_usd: 465 })).not.toBeNull();
    expect(erreurReglages({ ...R, seuil_gros_cc: 0 })).not.toBeNull();
    expect(erreurReglages({ ...R, caisse_yuan: NaN })).not.toBeNull();
    const { motocross: _m, ...sansCross } = R.volumes_m3;
    expect(erreurReglages({ ...R, volumes_m3: sansCross as Reglages["volumes_m3"] })).not.toBeNull();
    expect(erreurReglages({ ...R, volumes_m3: undefined as unknown as Reglages["volumes_m3"] })).not.toBeNull();
  });

  it("des réglages enregistrés avec des volumes vides sont complétés, pas cassés", () => {
    const r = completerReglages({ volumes_m3: undefined } as unknown as Partial<Reglages>);
    expect(erreurReglages(r)).toBeNull();
    expect(completerReglages({}).volumes_m3).toEqual(R.volumes_m3);
  });
});

describe("volume et marge restent internes", () => {
  const fichier = path.join(os.tmpdir(), `moto-import-limites-${process.pid}.json`);
  let pilote: Pilote;

  beforeAll(async () => {
    // Le chemin est lu au chargement du module : il doit être posé avant l'import.
    process.env.LOCAL_DB_PATH = fichier;
    const { creerPiloteLocal } = await import("@/lib/db/local");
    pilote = creerPiloteLocal();
  });

  afterAll(async () => {
    await fs.rm(fichier, { force: true });
  });

  it("publier() retire le volume et la marge", () => {
    const publique = publier({ reference: "MI-101", prix_ttc: 1, volume_m3: 1.42, marge_ar: 3_000_000 });
    expect(publique).toEqual({ reference: "MI-101", prix_ttc: 1 });
  });

  it("le magasin les garde côté admin et ne les sert pas au public", async () => {
    const saisie = motoSchema.parse({
      reference: "MI-970", marque: "BMW", modele: "R 1200 GS Adventure", annee: 2018, cylindree: 1170,
      categorie: "trail", etat: "neuf", statut: "disponible", prix_ttc: 50_000_000, prix_yuan: 65_800,
      taux_yuan: 670, acompte_pct: 80, prix_valable_jusqu_au: "2026-12-31", description: "Essai.",
      volume_m3: 1.42, marge_ar: 3_000_000,
    });
    const creee = await pilote.creerMoto(saisie);
    expect(creee).toMatchObject({ volume_m3: 1.42, marge_ar: 3_000_000 });

    const publique = await pilote.motoParSlug(creee.slug);
    expect(publique).not.toBeNull();
    const cles = Object.keys(publique!);
    for (const interne of ["volume_m3", "marge_ar", "prix_yuan", "taux_yuan", "fournisseur_id"]) {
      expect(cles, interne).not.toContain(interne);
    }

    // Vider la marge remet la fiche au calcul automatique sans toucher au volume.
    const videe = await pilote.majMoto(creee.id, { marge_ar: null });
    expect(videe).toMatchObject({ volume_m3: 1.42, marge_ar: null });
  });

  it("une fiche créée sans volume ni marge les porte à vide", async () => {
    const saisie = motoSchema.parse({
      reference: "MI-971", marque: "Honda", modele: "CB500X", annee: 2023, cylindree: 471,
      categorie: "trail", etat: "neuf", prix_ttc: 0, prix_valable_jusqu_au: "2026-12-31",
    });
    const creee = await pilote.creerMoto(saisie);
    expect(creee.volume_m3).toBeNull();
    expect(creee.marge_ar).toBeNull();
  });
});
