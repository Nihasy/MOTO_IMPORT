import { describe, expect, it } from "vitest";
import { appliquerFiltres, similaires, trierCatalogue } from "@/lib/db/filtres";
import { publier } from "@/lib/db/types";
import { lienDevis, messageDevis, messageMemeModele } from "@/lib/whatsapp";
import type { Moto, MotoAvecMedias, MotoPublique } from "@/lib/types";

const base = (o: Partial<MotoPublique> = {}): MotoPublique => ({
  id: o.id ?? crypto.randomUUID(),
  reference: o.reference ?? "MI-001",
  slug: o.slug ?? "honda-cb500x-2021-mi001",
  marque: o.marque ?? "Honda",
  modele: o.modele ?? "CB500X",
  annee: o.annee ?? 2021,
  cylindree: o.cylindree ?? 471,
  categorie: o.categorie ?? "trail",
  etat: o.etat ?? "occasion",
  statut: o.statut ?? "disponible",
  kilometrage: o.kilometrage ?? 18400,
  couleur: null, puissance_ch: null, poids_kg: null, hauteur_selle_mm: null,
  refroidissement: null, transmission: null, abs: false,
  prix_ttc: o.prix_ttc ?? 12_500_000,
  acompte_pct: o.acompte_pct ?? null,
  prix_valable_jusqu_au: "2026-12-31",
  delai_min_jours: 45, delai_max_jours: 65,
  garantie_mois: 6, garantie_texte: null,
  description: "Description", points_forts: [], etat_details: null,
  date_photos: "2026-01-10", date_vente: null, vues: 0,
  created_at: o.created_at ?? "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

describe("filtres du catalogue (9.2)", () => {
  const motos = [
    base({ reference: "MI-001", categorie: "trail", etat: "occasion", prix_ttc: 12_500_000, cylindree: 471, marque: "Honda", annee: 2021 }),
    base({ reference: "MI-002", categorie: "sportive", etat: "neuf", prix_ttc: 22_000_000, cylindree: 690, marque: "Yamaha", annee: 2024 }),
    base({ reference: "MI-003", categorie: "trail", etat: "neuf", prix_ttc: 9_000_000, cylindree: 320, marque: "Honda", annee: 2023, statut: "vendu" }),
    base({ reference: "MI-004", categorie: "custom", etat: "neuf", prix_ttc: 15_000_000, cylindree: 1200, marque: "Kawasaki", annee: 2022, statut: "archive" }),
  ];

  it("exclut toujours les fiches archivées", () => {
    expect(appliquerFiltres(motos).map((m) => m.reference)).not.toContain("MI-004");
  });

  it("filtre par catégorie", () => {
    expect(appliquerFiltres(motos, { categorie: ["trail"] })).toHaveLength(2);
  });

  it("filtre par état", () => {
    expect(appliquerFiltres(motos, { etat: "occasion" })).toHaveLength(1);
  });

  it("filtre par budget maximum", () => {
    expect(appliquerFiltres(motos, { prixMax: 13_000_000 }).map((m) => m.reference)).toEqual(["MI-001", "MI-003"]);
  });

  it("filtre par tranche de cylindrée", () => {
    expect(appliquerFiltres(motos, { cylindrees: ["250-400"] }).map((m) => m.reference)).toEqual(["MI-003"]);
    expect(appliquerFiltres(motos, { cylindrees: ["1000+"] })).toHaveLength(0); // MI-004 archivée
  });

  it("cumule les filtres", () => {
    const r = appliquerFiltres(motos, { categorie: ["trail"], etat: "neuf", prixMax: 10_000_000 });
    expect(r.map((m) => m.reference)).toEqual(["MI-003"]);
  });

  it("masque les vendues seulement si l'interrupteur est actif", () => {
    expect(appliquerFiltres(motos).map((m) => m.reference)).toContain("MI-003");
    expect(appliquerFiltres(motos, { masquerVendues: true }).map((m) => m.reference)).not.toContain("MI-003");
  });

  it("filtre par marque et par plage d'années", () => {
    expect(appliquerFiltres(motos, { marques: ["honda"] })).toHaveLength(2);
    expect(appliquerFiltres(motos, { anneeMin: 2023 })).toHaveLength(2);
  });

  it("recherche sur marque, modèle et référence", () => {
    expect(appliquerFiltres(motos, { recherche: "yamaha" })).toHaveLength(1);
    expect(appliquerFiltres(motos, { recherche: "MI-001" })).toHaveLength(1);
    expect(appliquerFiltres(motos, { recherche: "honda cb500x" })).toHaveLength(2);
  });

  it("renvoie une liste vide quand rien ne correspond", () => {
    expect(appliquerFiltres(motos, { recherche: "ducati" })).toHaveLength(0);
  });
});

describe("tri du catalogue (9.2)", () => {
  it("place disponible, puis réservé, puis vendu", () => {
    const l = trierCatalogue([
      base({ reference: "V", statut: "vendu" }),
      base({ reference: "R", statut: "reserve" }),
      base({ reference: "D", statut: "disponible" }),
    ]);
    expect(l.map((m) => m.reference)).toEqual(["D", "R", "V"]);
  });

  it("classe le plus récent d'abord à statut égal", () => {
    const l = trierCatalogue([
      base({ reference: "vieux", created_at: "2026-01-01T00:00:00.000Z" }),
      base({ reference: "neuf", created_at: "2026-06-01T00:00:00.000Z" }),
    ]);
    expect(l[0].reference).toBe("neuf");
  });
});

describe("motos similaires", () => {
  const avecMedias = (m: MotoPublique): MotoAvecMedias => ({ ...m, medias: [] });

  it("privilégie même catégorie, marque et prix voisin", () => {
    const ref = avecMedias(base({ reference: "MI-001", categorie: "trail", marque: "Honda", prix_ttc: 12_000_000, cylindree: 471 }));
    const toutes = [
      ref,
      avecMedias(base({ reference: "PROCHE", categorie: "trail", marque: "Honda", prix_ttc: 12_500_000, cylindree: 500 })),
      avecMedias(base({ reference: "LOIN", categorie: "custom", marque: "Kawasaki", prix_ttc: 30_000_000, cylindree: 1200 })),
    ];
    expect(similaires(toutes, ref, 3)[0].reference).toBe("PROCHE");
  });

  it("n'inclut jamais la moto elle-même", () => {
    const ref = avecMedias(base({ reference: "MI-001" }));
    expect(similaires([ref], ref, 3)).toHaveLength(0);
  });
});

describe("protection des fournisseurs (12.2)", () => {
  it("publier() retire fournisseur_id", () => {
    const interne = { ...base(), fournisseur_id: "secret-uuid" } as Moto;
    const publique = publier(interne);
    expect(JSON.stringify(publique)).not.toContain("fournisseur");
    expect(JSON.stringify(publique)).not.toContain("secret-uuid");
  });
});

describe("liens WhatsApp (9.3)", () => {
  it("le message contient référence, modèle, année et prix exacts", () => {
    const m = base({ reference: "MI-047", marque: "Honda", modele: "CB500X", annee: 2021, prix_ttc: 12_500_000 });
    const msg = messageDevis(m);
    expect(msg).toContain("MI-047");
    expect(msg).toContain("Honda CB500X 2021");
    expect(msg.replace(/[  ]/g, " ")).toContain("12 500 000 Ar");
  });

  it("une fiche vendue propose « trouvez-moi la même »", () => {
    const vendue = base({ statut: "vendu" });
    expect(lienDevis(vendue)).toContain(encodeURIComponent("est vendue"));
    expect(messageMemeModele(vendue)).toMatch(/equivalent/);
  });

  it("produit une URL wa.me encodée", () => {
    const url = lienDevis(base());
    expect(url.startsWith("https://wa.me/")).toBe(true);
    expect(url).toContain("?text=");
    expect(url).not.toContain(" ");
  });
});
