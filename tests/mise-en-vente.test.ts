import { describe, expect, it } from "vitest";
import { analyserCsvMotos } from "@/lib/import-csv";
import { CSV_MODELE, COLONNES_CSV } from "@/lib/csv";
import { REGLAGES_DEFAUT } from "@/lib/tarification-defaut";
import { miseEnVenteDe, statutDeMiseEnVente } from "@/lib/types";

const analyser = (csv: string) => analyserCsvMotos(csv, REGLAGES_DEFAUT);
const ENTETE = "reference;marque;modele;annee;cylindree;categorie;etat;prix_yuan;prix_valable_jusqu_au;disponibilite";
const ligne = (dispo: string, ref = "MI-130") => `${ref};Honda;CB500X;2023;471;trail;neuf;15000;31/12/2026;${dispo}`;

describe("mise en vente : sur commande ou déjà au local", () => {
  it("chaque mise en vente correspond à un statut public", () => {
    expect(statutDeMiseEnVente("commande")).toBe("disponible");
    expect(statutDeMiseEnVente("local")).toBe("dispo_immediate");
  });

  it("une fiche ancienne sans la colonne se déduit de son statut", () => {
    expect(miseEnVenteDe({ statut: "dispo_immediate" })).toBe("local");
    expect(miseEnVenteDe({ statut: "brouillon" })).toBe("commande");
    expect(miseEnVenteDe({ statut: "brouillon", mise_en_vente: "local" })).toBe("local");
  });

  it("CSV : « local » et ses variantes donnent une moto au local, toujours en brouillon", () => {
    for (const v of ["local", "Disponible de suite", "stock", "au local"]) {
      const r = analyser(`${ENTETE}\n${ligne(v)}`);
      expect(r.ok, v).toBe(true);
      if (!r.ok) return;
      expect(r.motos[0]).toMatchObject({ mise_en_vente: "local", statut: "brouillon", mise_en_vente_fournie: true });
    }
  });

  it("CSV : vide ou « commande » donnent une moto sur commande", () => {
    for (const v of ["", "commande", "sur commande"]) {
      const r = analyser(`${ENTETE}\n${ligne(v)}`);
      expect(r.ok, v).toBe(true);
      if (!r.ok) return;
      expect(r.motos[0].mise_en_vente).toBe("commande");
      expect(r.motos[0].mise_en_vente_fournie).toBe(v !== "");
    }
  });

  it("CSV : une valeur inconnue est refusée avec sa colonne", () => {
    const r = analyser(`${ENTETE}\n${ligne("bientôt")}`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erreurs[0]).toMatchObject({ colonne: "disponibilite", valeur: "bientôt" });
  });

  it("le modèle contient la colonne et un exemple au local", () => {
    expect(COLONNES_CSV.map((c) => c.nom)).toContain("disponibilite");
    const r = analyser(CSV_MODELE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.motos.map((m) => m.mise_en_vente)).toEqual(["commande", "local"]);
  });
});
