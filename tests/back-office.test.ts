import { describe, expect, it } from "vitest";
import {
  GROUPES_ADMIN, appartientAuGroupe, correspondRecherche, effectifsAdmin, estGroupeAdmin,
  filtrerMotosAdmin, type LigneAdmin,
} from "@/lib/admin-filtres";
import { PERIODES, dansPeriode, debutDuMoisTana, debutPeriode, estPeriode } from "@/lib/periodes";
import { mediaPatchSchema } from "@/lib/schemas";
import { controlesPublication } from "@/lib/publication";

const ligne = (o: Partial<LigneAdmin> = {}): LigneAdmin => ({
  reference: "MI-001",
  marque: "Honda",
  modele: "CB500X",
  annee: 2023,
  statut: "disponible",
  etat: "neuf",
  nb_photos: 9,
  vues_manquantes: [],
  ...o,
});

describe("filtres de la liste d'administration", () => {
  const catalogue: LigneAdmin[] = [
    ligne({ reference: "MI-001", statut: "disponible" }),
    ligne({ reference: "MI-002", statut: "dispo_immediate" }),
    ligne({ reference: "MI-003", statut: "brouillon", nb_photos: 2, vues_manquantes: ["compteur"] }),
    ligne({ reference: "MI-004", statut: "vendu" }),
    ligne({ reference: "MI-005", statut: "archive" }),
    ligne({
      reference: "MI-006", statut: "disponible", nb_photos: 4, vues_manquantes: ["moteur"],
      marque: "Yamaha", modele: "MT-03",
    }),
  ];

  it("range chaque fiche dans le bon groupe", () => {
    expect(appartientAuGroupe(ligne({ statut: "brouillon" }), "brouillon")).toBe(true);
    expect(appartientAuGroupe(ligne({ statut: "vendu" }), "en_ligne")).toBe(false);
    expect(appartientAuGroupe(ligne({ statut: "disponible" }), "en_ligne")).toBe(true);
    expect(appartientAuGroupe(ligne({ statut: "dispo_immediate" }), "en_ligne")).toBe(true);
    expect(appartientAuGroupe(ligne({ statut: "archive" }), "en_ligne")).toBe(false);
  });

  it("signale une vue manquante quel que soit le statut ou le nombre de photos", () => {
    const manquante = ligne({ nb_photos: 30, vues_manquantes: ["compteur"] });
    expect(appartientAuGroupe(manquante, "incompletes")).toBe(true);
    expect(appartientAuGroupe({ ...manquante, statut: "brouillon" }, "incompletes")).toBe(true);
    // Un lot fournisseur réduit mais complet n'est pas une fiche incomplète.
    expect(appartientAuGroupe(ligne({ nb_photos: 3 }), "incompletes")).toBe(false);
  });

  it("compte les effectifs de chaque puce", () => {
    const e = effectifsAdmin(catalogue);
    expect(e.tous).toBe(6);
    expect(e.brouillon).toBe(1);
    expect(e.en_ligne).toBe(3);
    expect(e.vendu).toBe(1);
    expect(e.archive).toBe(1);
    expect(e.incompletes).toBe(2);
  });

  it("restreint au lieu d'élargir quand la recherche a plusieurs mots", () => {
    expect(correspondRecherche(ligne(), "honda")).toBe(true);
    expect(correspondRecherche(ligne(), "honda cb500x")).toBe(true);
    expect(correspondRecherche(ligne(), "honda mt-03")).toBe(false);
    expect(correspondRecherche(ligne(), "2023")).toBe(true);
    expect(correspondRecherche(ligne(), "mi-001")).toBe(true);
    expect(correspondRecherche(ligne(), "")).toBe(true);
  });

  it("cumule recherche et groupe", () => {
    expect(filtrerMotosAdmin(catalogue, { groupe: "en_ligne", q: "yamaha" })).toHaveLength(1);
    expect(filtrerMotosAdmin(catalogue, { groupe: "brouillon", q: "yamaha" })).toHaveLength(0);
    expect(filtrerMotosAdmin(catalogue, {})).toHaveLength(6);
  });

  it("ignore un groupe inventé dans l'URL", () => {
    expect(estGroupeAdmin("brouillon")).toBe(true);
    expect(estGroupeAdmin("n_importe_quoi")).toBe(false);
    expect(estGroupeAdmin(undefined)).toBe(false);
    expect(Object.keys(GROUPES_ADMIN)).toContain("incompletes");
  });
});

describe("filtre par période du CRM (10.5)", () => {
  // Horloge figée : une borne de période calculée sur l'heure courante ne se
  // vérifie pas de façon reproductible.
  const maintenant = new Date("2026-09-15T12:00:00.000Z");
  const ilYA = (jours: number) =>
    new Date(maintenant.getTime() - jours * 86_400_000).toISOString();

  it("« depuis toujours » ne borne rien", () => {
    expect(debutPeriode("tout", maintenant)).toBeNull();
    expect(dansPeriode(ilYA(4000), "tout", maintenant)).toBe(true);
  });

  it("retient les 7 et les 30 derniers jours", () => {
    expect(dansPeriode(ilYA(3), "7j", maintenant)).toBe(true);
    expect(dansPeriode(ilYA(10), "7j", maintenant)).toBe(false);
    expect(dansPeriode(ilYA(10), "30j", maintenant)).toBe(true);
    expect(dansPeriode(ilYA(45), "30j", maintenant)).toBe(false);
  });

  it("« ce mois-ci » part du premier du mois, pas de 30 jours en arrière", () => {
    expect(dansPeriode("2026-09-01T00:00:00.000Z", "mois", maintenant)).toBe(true);
    expect(dansPeriode("2026-08-15T00:00:00.000Z", "mois", maintenant)).toBe(false);
  });

  it("borne le mois sur l'heure d'Antananarivo, pas sur celle du serveur", () => {
    // Vercel tourne en UTC ; Madagascar est à UTC+3 sans heure d'été. Le mois
    // commence donc à 21 h UTC la veille.
    expect(debutDuMoisTana(maintenant).toISOString()).toBe("2026-08-31T21:00:00.000Z");
    // 1er septembre, 2 h du matin à Tana : dans le mois.
    expect(dansPeriode("2026-08-31T23:00:00.000Z", "mois", maintenant)).toBe(true);
    // 31 août, 23 h à Tana : hors du mois.
    expect(dansPeriode("2026-08-31T20:00:00.000Z", "mois", maintenant)).toBe(false);
  });

  it("ignore une période inventée et une date illisible", () => {
    expect(estPeriode("7j")).toBe(true);
    expect(estPeriode("depuis-toujours")).toBe(false);
    expect(dansPeriode("pas une date", "7j", maintenant)).toBe(false);
    expect(Object.keys(PERIODES)).toHaveLength(4);
  });
});

describe("liste blanche des champs de média (11)", () => {
  it("accepte les champs éditables au back-office", () => {
    const r = mediaPatchSchema.safeParse({
      vue: "compteur",
      origine: "constructeur",
      alt: "Honda CB500X compteur",
      legende: "Kilométrage relevé au dépôt",
    });
    expect(r.success).toBe(true);
  });

  it("refuse le rattachement d'une photo à une autre moto", () => {
    expect(mediaPatchSchema.safeParse({ moto_id: "autre-moto" }).success).toBe(false);
  });

  it("refuse la réécriture de l'ordre et du fichier", () => {
    expect(mediaPatchSchema.safeParse({ ordre: 1 }).success).toBe(false);
    expect(mediaPatchSchema.safeParse({ cloudinary_id: "autre" }).success).toBe(false);
  });

  it("refuse une vue hors énumération", () => {
    expect(mediaPatchSchema.safeParse({ vue: "selfie" }).success).toBe(false);
  });
});

describe("cohérence description / statut", () => {
  const base = {
    id: "1", reference: "MI-005", slug: "s", marque: "Suzuki", modele: "V-Strom 650",
    annee: 2022, cylindree: 645, categorie: "trail", etat: "neuf",
    kilometrage: null, couleur: null, puissance_ch: null, poids_kg: null,
    hauteur_selle_mm: null, refroidissement: null, transmission: null, abs: false,
    prix_ttc: 21_500_000, prix_valable_jusqu_au: "2026-12-31",
    delai_min_jours: 45, delai_max_jours: 65, garantie_mois: 12, garantie_texte: "Moteur",
    points_forts: [], etat_details: null, date_photos: null, fournisseur_id: null,
    date_vente: null, vues: 0, created_at: "", updated_at: "",
  };
  const surPlace = "Cette moto est déjà à Antananarivo, dans notre local.";
  const neutre = Array(160).fill("mot").join(" ");

  const controle = (o: Record<string, unknown>) =>
    controlesPublication({ ...base, ...o } as never, []).find((c) =>
      c.libelle.includes("cohérente avec le statut")
    );

  it("accepte la promesse « sur place » quand le statut la porte", () => {
    expect(controle({ statut: "dispo_immediate", description: neutre + " " + surPlace })?.ok).toBe(true);
  });

  it("refuse la promesse « sur place » sur une moto en commande", () => {
    for (const statut of ["disponible", "reserve"] as const) {
      const c = controle({ statut, description: neutre + " " + surPlace });
      expect(c?.ok).toBe(false);
      expect(c?.detail).toMatch(/déjà sur place/);
    }
  });

  it("laisse passer une description qui ne promet rien", () => {
    expect(controle({ statut: "disponible", description: neutre })?.ok).toBe(true);
    expect(controle({ statut: "dispo_immediate", description: neutre })?.ok).toBe(true);
  });
});
