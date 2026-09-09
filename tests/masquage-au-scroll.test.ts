import { describe, expect, it } from "vitest";
import { decider } from "@/components/ui/masquage-au-scroll";

/**
 * Le masquage du chrome au défilement (navigation immersive). La règle est
 * testée ici sans fenêtre : c'est elle qui décide, le reste n'est que le
 * branchement de l'écouteur et deux classes de translation.
 */
describe("masquage du chrome au défilement", () => {
  it("garde tout affiché près du sommet, même en descendant", () => {
    expect(decider(0, 0, true).visible).toBe(true);
    expect(decider(40, 0, true).visible).toBe(true);
    // Même en arrivant du bas avec le chrome escamoté, le sommet le rappelle.
    expect(decider(50, 400, false).visible).toBe(true);
  });

  it("escamote le chrome quand on descend franchement", () => {
    const d = decider(400, 200, true);
    expect(d.visible).toBe(false);
    expect(d.repere).toBe(400);
  });

  it("le rappelle dès qu'on remonte", () => {
    expect(decider(300, 400, false).visible).toBe(true);
  });

  it("ignore les tremblements sans déplacer le repère", () => {
    // Sous le seuil de course : ni bascule, ni glissement du repère, sans quoi
    // une suite de micro-gestes finirait par franchir le seuil à petits pas.
    const d = decider(404, 400, true);
    expect(d.visible).toBe(true);
    expect(d.repere).toBe(400);

    const e = decider(396, 400, false);
    expect(e.visible).toBe(false);
    expect(e.repere).toBe(400);
  });

  it("accumule les petits gestes jusqu'à former une intention", () => {
    // Trois pas de 4 px : le repère reste à 400, donc le troisième relevé est
    // à 12 px du repère et bascule, là où un repère glissant n'aurait jamais
    // vu qu'un écart de 4 px.
    let etat = { visible: true, repere: 400 };
    for (const y of [404, 408, 412]) {
      etat = decider(y, etat.repere, etat.visible);
    }
    expect(etat.visible).toBe(false);
  });

  it("traite une position négative comme le sommet (élan de fin de course)", () => {
    expect(decider(-120, 500, false).visible).toBe(true);
  });
});
