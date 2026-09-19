import { describe, expect, it } from "vitest";
import { normaliserWhatsapp, parametresSchema } from "@/lib/schemas";
import { lienTelephone } from "@/lib/parametres";
import { lienDevis, lienRecherche, NUMERO_WHATSAPP } from "@/lib/whatsapp";
import { ACOMPTE_COMMANDE, SOLDE_LIVRAISON } from "@/lib/conditions";

describe("numéros saisis dans le back-office", () => {
  it("accepte le format local, international ou 00", () => {
    expect(normaliserWhatsapp("034 12 345 67")).toBe("261341234567");
    expect(normaliserWhatsapp("+261 34 12 345 67")).toBe("261341234567");
    expect(normaliserWhatsapp("00261 34 12 345 67")).toBe("261341234567");
    expect(normaliserWhatsapp("261341234567")).toBe("261341234567");
  });

  it("construit un lien tel: international", () => {
    expect(lienTelephone("034 12 345 67")).toBe("tel:+261341234567");
    expect(lienTelephone("+261 34 12 345 67")).toBe("tel:+261341234567");
    expect(lienTelephone("00261 34 12 345 67")).toBe("tel:+261341234567");
  });
});

describe("validation des paramètres", () => {
  const valides = {
    adresse: "Lot II M 85 Bis, Analamahitsy",
    horaires: [{ jours: "Lundi – vendredi", heures: "8 h 30 – 17 h 30" }],
    whatsapp: "261341234567",
    telephone: "+261 34 12 345 67",
  };

  it("accepte une saisie complète", () => {
    expect(parametresSchema.safeParse(valides).success).toBe(true);
  });

  it("refuse un numéro WhatsApp sans assez de chiffres", () => {
    expect(parametresSchema.safeParse({ ...valides, whatsapp: "12345" }).success).toBe(false);
  });

  it("refuse une ligne d'horaires à moitié remplie", () => {
    const r = parametresSchema.safeParse({ ...valides, horaires: [{ jours: "Samedi", heures: "" }] });
    expect(r.success).toBe(false);
  });

  it("accepte l'absence d'horaires", () => {
    expect(parametresSchema.safeParse({ ...valides, horaires: [] }).success).toBe(true);
  });
});

describe("liens WhatsApp", () => {
  const moto = {
    marque: "Honda", modele: "CB500X", annee: 2023, reference: "MI-001", prix_ttc: 14_500_000,
    statut: "disponible",
  } as Parameters<typeof lienDevis>[0];

  it("utilisent le numéro réglé dans le back-office", () => {
    expect(lienDevis(moto, "261329999999")).toMatch(/^https:\/\/wa\.me\/261329999999\?text=/);
    expect(lienRecherche(undefined, "261329999999")).toMatch(/^https:\/\/wa\.me\/261329999999\?/);
  });

  it("retombent sur le numéro de l'environnement sans numéro fourni", () => {
    expect(lienDevis(moto)).toMatch(new RegExp(`^https://wa\.me/${NUMERO_WHATSAPP}\?`));
    expect(lienRecherche(undefined, "")).toMatch(new RegExp(`^https://wa\.me/${NUMERO_WHATSAPP}\?`));
  });
});

describe("conditions de paiement", () => {
  it("acompte et solde font 100 %", () => {
    expect(ACOMPTE_COMMANDE).toBe(70);
    expect(ACOMPTE_COMMANDE + SOLDE_LIVRAISON).toBe(100);
  });
});
