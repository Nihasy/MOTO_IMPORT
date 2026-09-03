import { describe, expect, it } from "vitest";
import {
  ar,
  arCourt,
  compterMots,
  construireSlug,
  dateFr,
  estNouvelle,
  joursAvant,
  slugifier,
} from "@/lib/format";

const FINE = " "; // espace fine insécable
const NBSP = " "; // espace insécable

describe("formatage de l'Ariary (17.3)", () => {
  it("insère des espaces fines insécables et un NBSP avant l'unité", () => {
    expect(ar(12500000)).toBe(`12${FINE}500${FINE}000${NBSP}Ar`);
  });

  it("rend la sortie attendue, espaces normalisés", () => {
    expect(ar(12500000).replace(/[  ]/g, " ")).toBe("12 500 000 Ar");
  });

  it("n'affiche jamais de décimales", () => {
    expect(ar(9999999.6)).not.toContain(",");
    expect(ar(9999999.6)).not.toContain(".");
  });

  it("gère les petits nombres", () => {
    expect(ar(500)).toBe(`500${NBSP}Ar`);
    expect(ar(1000)).toBe(`1${FINE}000${NBSP}Ar`);
  });

  it("abrège en millions", () => {
    expect(arCourt(12000000)).toBe(`12${NBSP}M${NBSP}Ar`);
    expect(arCourt(12500000)).toBe(`12,5${NBSP}M${NBSP}Ar`);
    expect(arCourt(500000)).toBe(`500${FINE}000${NBSP}Ar`);
  });
});

describe("slug", () => {
  it("retire les accents et normalise", () => {
    expect(slugifier("Café Racer Été")).toBe("cafe-racer-ete");
  });

  it("construit le slug attendu par le SEO (13.1)", () => {
    expect(construireSlug("Honda", "CB500X", 2021, "MI-047")).toBe("honda-cb500x-2021-mi047");
  });
});

describe("dates", () => {
  it("formate en JJ/MM/AAAA", () => {
    expect(dateFr("2026-03-09")).toBe("09/03/2026");
  });

  it("renvoie une chaîne vide si la date est absente ou illisible", () => {
    expect(dateFr(null)).toBe("");
    expect(dateFr("n'importe quoi")).toBe("");
  });

  it("compte les jours restants", () => {
    const dans5 = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(joursAvant(dans5)).toBe(5);
  });
});

describe("comptage de mots", () => {
  it("compte les mots séparés par des espaces multiples", () => {
    expect(compterMots("  un   deux\ntrois ")).toBe(3);
    expect(compterMots("")).toBe(0);
  });
});

describe("fenêtre de nouveauté (24 h)", () => {
  const T0 = Date.parse("2026-09-02T12:00:00.000Z");
  const ilYA = (ms: number) => new Date(T0 - ms).toISOString();

  it("signale une fiche mise en ligne à l'instant", () => {
    expect(estNouvelle(ilYA(0), T0)).toBe(true);
  });

  it("tient encore à vingt-trois heures", () => {
    expect(estNouvelle(ilYA(23 * 3_600_000), T0)).toBe(true);
  });

  it("s'efface dès vingt-quatre heures révolues", () => {
    expect(estNouvelle(ilYA(24 * 3_600_000), T0)).toBe(false);
    expect(estNouvelle(ilYA(30 * 3_600_000), T0)).toBe(false);
  });

  it("ignore une date absente, illisible ou dans le futur", () => {
    expect(estNouvelle(null, T0)).toBe(false);
    expect(estNouvelle("pas une date", T0)).toBe(false);
    expect(estNouvelle(new Date(T0 + 3_600_000).toISOString(), T0)).toBe(false);
  });
});
