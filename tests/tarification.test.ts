import { describe, expect, it } from "vitest";
import {
  calculerPrix, erreurReglages, prixDynamique, recalculerAuPassage,
} from "@/lib/tarification";
import { REGLAGES_DEFAUT } from "@/lib/tarification-defaut";
import { ACOMPTE_MAX, ACOMPTE_MIN } from "@/lib/conditions";

const R = REGLAGES_DEFAUT;

describe("calcul du prix (2 M + 10 %, 670 Ar, fret 5 M)", () => {
  it("reproduit la simulation validée", () => {
    const attendus: [number, number, number, number][] = [
      // ¥, prix, bénéfice, acompte
      [8_000, 12_900_000, 2_540_000, 45],
      [15_000, 18_100_000, 3_050_000, 60],
      [20_000, 21_750_000, 3_350_000, 65],
      [29_000, 28_400_000, 3_970_000, 75],
      [37_000, 34_300_000, 4_510_000, 75],
      [45_000, 40_200_000, 5_050_000, 80],
    ];
    for (const [y, prix, benefice, acompte] of attendus) {
      const c = calculerPrix(y, R);
      expect(c.prix_ar, `${y} ¥`).toBe(prix);
      expect(c.benefice_ar, `${y} ¥`).toBe(benefice);
      expect(c.acompte_pct, `${y} ¥`).toBe(acompte);
    }
  });

  it("arrondit le prix au palier supérieur", () => {
    const c = calculerPrix(15_000, R);
    expect(c.prix_ar % R.arrondi_ar).toBe(0);
    expect(c.prix_ar).toBeGreaterThanOrEqual(c.cout_ar + R.benefice_fixe_ar);
  });

  it("n'engage aucun capital dans la gamme courante", () => {
    for (let y = 5_000; y <= 50_000; y += 500) {
      const c = calculerPrix(y, R);
      expect(c.capital_avance_ar, `${y} ¥`).toBe(0);
      expect(c.acompte_ar, `${y} ¥`).toBeGreaterThanOrEqual(c.achat_ar);
      expect(c.solde_couvre_fret, `${y} ¥`).toBe(true);
    }
  });

  it("ne produit jamais d'inversion de prix", () => {
    let precedent = calculerPrix(3_000, R);
    for (let y = 3_100; y <= 80_000; y += 100) {
      const c = calculerPrix(y, R);
      expect(c.prix_ar).toBeGreaterThanOrEqual(precedent.prix_ar);
      expect(c.benefice_ar).toBeGreaterThanOrEqual(R.benefice_fixe_ar);
      precedent = c;
    }
  });

  it("borne l'acompte aux CGV et signale le capital avancé au-delà", () => {
    expect(calculerPrix(1_000, R).acompte_pct).toBe(ACOMPTE_MIN);
    const tresChere = calculerPrix(120_000, R);
    expect(tresChere.acompte_pct).toBe(ACOMPTE_MAX);
    expect(tresChere.capital_avance_ar).toBeGreaterThan(0);
  });

  it("acompte + solde = prix", () => {
    const c = calculerPrix(23_456, R);
    expect(c.acompte_ar + c.solde_ar).toBe(c.prix_ar);
  });
});

describe("statuts figés", () => {
  it("seuls brouillon et disponible suivent les réglages", () => {
    expect(prixDynamique("brouillon")).toBe(true);
    expect(prixDynamique("disponible")).toBe(true);
    for (const s of ["dispo_immediate", "reserve", "vendu", "archive"] as const) {
      expect(prixDynamique(s), s).toBe(false);
    }
  });

  it("l'arrivée au local recalcule une dernière fois, la réservation non", () => {
    expect(recalculerAuPassage("dispo_immediate")).toBe(true);
    expect(recalculerAuPassage("disponible")).toBe(true);
    expect(recalculerAuPassage("reserve")).toBe(false);
    expect(recalculerAuPassage("vendu")).toBe(false);
  });
});

describe("réglages", () => {
  it("acceptent les valeurs par défaut", () => {
    expect(erreurReglages(R)).toBeNull();
  });
  it("refusent un taux tapé avec un zéro de trop", () => {
    expect(erreurReglages({ ...R, taux_yuan: 6_700 })).not.toBeNull();
  });
});
