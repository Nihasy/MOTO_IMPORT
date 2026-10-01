import { describe, expect, it } from "vitest";
import {
  calculerPrix, erreurReglages, prixDynamique, recalculerAuPassage, type Gabarit, type Reglages,
} from "@/lib/tarification";
import { REGLAGES_DEFAUT, completerReglages } from "@/lib/tarification-defaut";
import { CATEGORIES } from "@/lib/types";
import { ACOMPTE_MAX, ACOMPTE_MIN } from "@/lib/conditions";

const R = REGLAGES_DEFAUT;
/** Roadster de moyenne cylindrée, au volume standard de sa catégorie. */
const ROADSTER: Gabarit = { categorie: "roadster", cylindree: 650 };

describe("calcul du prix (2 M + 10 %, 670 Ar, fret au volume)", () => {
  it("reproduit la simulation validée", () => {
    const attendus: [number, Gabarit, number, number, number][] = [
      // ¥, gabarit, prix, bénéfice, acompte
      [8_000, ROADSTER, 11_450_000, 2_547_600, 55],
      [15_000, ROADSTER, 16_600_000, 3_007_600, 65],
      [15_000, { categorie: "trail", cylindree: 471 }, 16_850_000, 3_006_500, 65],
      [26_800, { categorie: "roadster", cylindree: 1043, volume_m3: 1.15 }, 25_900_000, 3_817_900, 75],
      [29_000, { categorie: "sportive", cylindree: 999, volume_m3: 1.09 }, 27_400_000, 3_944_340, 75],
      [8_980, { categorie: "motocross", cylindree: 250 }, 11_450_000, 2_644_300, 60],
      [30_000, { categorie: "scooter", cylindree: 530 }, 28_500_000, 4_020_600, 75],
    ];
    for (const [y, g, prix, benefice, acompte] of attendus) {
      const c = calculerPrix(y, R, g);
      expect(c.prix_ar, `${y} ¥`).toBe(prix);
      expect(c.benefice_ar, `${y} ¥`).toBe(benefice);
      expect(c.acompte_pct, `${y} ¥`).toBe(acompte);
    }
  });

  it("arrondit le prix au palier supérieur", () => {
    const c = calculerPrix(15_000, R, ROADSTER);
    expect(c.prix_ar % R.arrondi_ar).toBe(0);
    expect(c.prix_ar).toBeGreaterThanOrEqual(c.cout_ar + R.benefice_fixe_ar);
  });

  it("n'engage aucun capital dans la gamme courante", () => {
    for (let y = 5_000; y <= 45_000; y += 500) {
      for (const categorie of CATEGORIES) {
        const c = calculerPrix(y, R, { categorie, cylindree: 650 });
        expect(c.capital_avance_ar, `${y} ¥ ${categorie}`).toBe(0);
        expect(c.acompte_ar, `${y} ¥ ${categorie}`).toBeGreaterThanOrEqual(c.achat_ar + c.caisse_ar);
        expect(c.solde_couvre_fret, `${y} ¥ ${categorie}`).toBe(true);
      }
    }
  });

  it("ne produit jamais d'inversion de prix", () => {
    let precedent = calculerPrix(3_000, R, ROADSTER);
    for (let y = 3_100; y <= 80_000; y += 100) {
      const c = calculerPrix(y, R, ROADSTER);
      expect(c.prix_ar).toBeGreaterThanOrEqual(precedent.prix_ar);
      expect(c.benefice_ar).toBeGreaterThanOrEqual(R.benefice_fixe_ar);
      precedent = c;
    }
  });

  it("borne l'acompte aux CGV et signale le capital avancé au-delà", () => {
    expect(calculerPrix(1_000, R, ROADSTER).acompte_pct).toBe(ACOMPTE_MIN);
    const tresChere = calculerPrix(120_000, R, ROADSTER);
    expect(tresChere.acompte_pct).toBe(ACOMPTE_MAX);
    expect(tresChere.capital_avance_ar).toBeGreaterThan(0);
  });

  it("acompte + solde = prix", () => {
    const c = calculerPrix(23_456, R, ROADSTER);
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

describe("fret au volume (01/10/2026)", () => {
  it("compte le volume au cours du mètre cube et du dollar", () => {
    const c = calculerPrix(10_000, R, { categorie: "roadster", cylindree: 650, volume_m3: 1 });
    expect(c.transport_ar).toBe(360 * 4_650);
    expect(c.fret_ar).toBe(c.transport_ar + c.dossier_ar);
  });

  it("prend le volume de la fiche, sinon le standard de la catégorie", () => {
    expect(calculerPrix(10_000, R, { categorie: "trail", cylindree: 500 }).volume_m3).toBe(R.volumes_m3.trail);
    expect(calculerPrix(10_000, R, { categorie: "trail", cylindree: 500, volume_m3: null }).volume_m3).toBe(R.volumes_m3.trail);
    expect(calculerPrix(10_000, R, { categorie: "trail", cylindree: 1170, volume_m3: 1.42 }).volume_m3).toBe(1.42);
  });

  it("une caisse plus grosse coûte plus cher, à moto égale", () => {
    const petite = calculerPrix(30_000, R, { categorie: "trail", cylindree: 800, volume_m3: 1.13 });
    const grosse = calculerPrix(30_000, R, { categorie: "trail", cylindree: 800, volume_m3: 1.42 });
    expect(grosse.prix_ar).toBeGreaterThan(petite.prix_ar);
  });

  it("applique le gros dossier aux « 1000 », 998 et 999 cm³ compris", () => {
    const dossier = (cylindree: number) => calculerPrix(10_000, R, { categorie: "sportive", cylindree }).dossier_ar;
    expect(dossier(847)).toBe(1_500_000);
    expect(dossier(948)).toBe(1_500_000);
    expect(dossier(998)).toBe(2_000_000);
    expect(dossier(999)).toBe(2_000_000);
    expect(dossier(1043)).toBe(2_000_000);
  });

  /**
   * La caisse se paie au fournisseur avec la moto : l'acompte doit la couvrir,
   * sinon l'exploitant l'avance — le travers que le fret cross avait corrigé
   * pour le prix d'achat. Elle ne porte pas de marge.
   */
  it("fait couvrir la caisse par l'acompte, sans marge dessus", () => {
    const sans = calculerPrix(20_000, { ...R, caisse_yuan: 0, arrondi_ar: 1 }, ROADSTER);
    const avec = calculerPrix(20_000, { ...R, arrondi_ar: 1 }, ROADSTER);
    expect(avec.caisse_ar).toBe(300 * 670);
    expect(avec.prix_ar - sans.prix_ar).toBe(avec.caisse_ar);
    expect(avec.benefice_ar).toBe(sans.benefice_ar);
    expect(avec.acompte_ar + avec.capital_avance_ar).toBeGreaterThanOrEqual(avec.achat_ar + avec.caisse_ar);
  });

  it("une moto de cross suit la même règle, avec son petit volume", () => {
    const cross = calculerPrix(8_980, R, { categorie: "motocross", cylindree: 250 });
    expect(cross.fret_ar).toBe(Math.round(R.volumes_m3.motocross * 360 * 4_650) + 1_500_000);
    expect(cross.fret_ar).toBeLessThan(calculerPrix(8_980, R, ROADSTER).fret_ar);
  });

  it("complète des réglages enregistrés avant le fret au volume", () => {
    // Ce que la base contenait le 30/09/2026 : ni dollar, ni volumes.
    const anciens = { taux_yuan: 680, fret_ar: 5_000_000, fret_cross_ar: 3_157_500, benefice_fixe_ar: 2_000_000 };
    const r = completerReglages(anciens as Partial<Reglages>);
    expect(erreurReglages(r)).toBeNull();
    expect(r.taux_yuan).toBe(680);
    expect(r.volumes_m3).toEqual(R.volumes_m3);
    // Un seul volume enregistré ne fait pas perdre les autres.
    const partiel = completerReglages({ volumes_m3: { motocross: 0.7 } } as unknown as Partial<Reglages>);
    expect(partiel.volumes_m3.motocross).toBe(0.7);
    expect(partiel.volumes_m3.trail).toBe(R.volumes_m3.trail);
  });

  it("refuse des réglages de fret invalides", () => {
    expect(erreurReglages({ ...R, taux_usd: 46 })).not.toBeNull();
    expect(erreurReglages({ ...R, fret_usd_m3: NaN })).not.toBeNull();
    expect(erreurReglages({ ...R, dossier_ar: -1 })).not.toBeNull();
    expect(erreurReglages({ ...R, volumes_m3: { ...R.volumes_m3, scooter: 0 } })).not.toBeNull();
    expect(erreurReglages({ ...R, volumes_m3: { ...R.volumes_m3, trail: NaN } })).not.toBeNull();
  });
});

describe("marge fixée à la main (01/10/2026)", () => {
  it("remplace le bénéfice calculé, fret et caisse inchangés", () => {
    const auto = calculerPrix(20_000, R, ROADSTER);
    const main = calculerPrix(20_000, R, { ...ROADSTER, marge_ar: 5_000_000 });
    expect(auto.marge_manuelle).toBe(false);
    expect(main.marge_manuelle).toBe(true);
    expect(main.cout_ar).toBe(auto.cout_ar);
    expect(main.prix_ar).toBe(Math.ceil((main.cout_ar + 5_000_000) / R.arrondi_ar) * R.arrondi_ar);
    // L'arrondi au palier supérieur ne retire jamais rien à la marge saisie.
    expect(main.benefice_ar).toBeGreaterThanOrEqual(5_000_000);
    expect(main.benefice_ar).toBeLessThan(5_000_000 + R.arrondi_ar);
  });

  it("vide, laisse le calcul automatique", () => {
    const auto = calculerPrix(20_000, R, ROADSTER);
    expect(calculerPrix(20_000, R, { ...ROADSTER, marge_ar: null })).toEqual(auto);
    expect(calculerPrix(20_000, R, { ...ROADSTER, marge_ar: undefined })).toEqual(auto);
  });

  it("zéro est une marge : la moto part à prix coûtant", () => {
    const c = calculerPrix(20_000, { ...R, arrondi_ar: 1 }, { ...ROADSTER, marge_ar: 0 });
    expect(c.marge_manuelle).toBe(true);
    expect(c.prix_ar).toBe(c.cout_ar);
    expect(c.benefice_ar).toBe(0);
  });

  it("ne dépend plus des réglages de bénéfice", () => {
    const g = { ...ROADSTER, marge_ar: 3_000_000 };
    const autres = { ...R, benefice_fixe_ar: 9_000_000, part_achat_pct: 40 };
    expect(calculerPrix(20_000, autres, g).prix_ar).toBe(calculerPrix(20_000, R, g).prix_ar);
  });

  it("l'acompte couvre toujours l'achat et la caisse", () => {
    const c = calculerPrix(20_000, R, { ...ROADSTER, marge_ar: 1_000_000 });
    expect(c.acompte_ar + c.capital_avance_ar).toBeGreaterThanOrEqual(c.achat_ar + c.caisse_ar);
    expect(c.acompte_ar + c.solde_ar).toBe(c.prix_ar);
  });
});
