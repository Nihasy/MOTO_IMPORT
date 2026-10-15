import { describe, expect, it } from "vitest";
import {
  MAX_ALBUM, MAX_TITRE, PROGRAMMATION_MAX_MS, PROGRAMMATION_MIN_MS, albumSchema, dansBudget,
  erreurProgrammation, estPromouvable, filtrerStudio, filtresDepuisParams, historiqueParMoto,
  legendeAlbum, legendePhoto, selectionVariee, texteKit, ventesASignaler, type LigneStudio,
} from "@/lib/facebook";
import { creerZip } from "@/lib/zip";
import type { Media, PublicationFb } from "@/lib/types";

/**
 * Cas limites du Studio Facebook : ce qu'une URL bricolée, une fiche
 * incomplète ou une horloge à la seconde près peuvent lui faire.
 */

const MAINTENANT = new Date("2026-10-15T12:00:00Z").getTime();
const JOUR = 86_400_000;
const ilYA = (j: number) => new Date(MAINTENANT - j * JOUR).toISOString();
const photo = { id: "p", cloudinary_id: "x", origine: "reelle" } as Media;

const moto = (o: Partial<LigneStudio> = {}): LigneStudio => ({
  id: "id",
  reference: "MI-100",
  slug: "s",
  marque: "Yamaha",
  modele: "MT-07",
  annee: 2021,
  cylindree: 689,
  categorie: "roadster",
  etat: "occasion",
  statut: "disponible",
  kilometrage: 12000,
  prix_ttc: 18_500_000,
  created_at: ilYA(1),
  mise_en_vente: "commande",
  couverture: photo,
  ...o,
});

const pub = (o: Partial<PublicationFb> = {}): PublicationFb => ({
  id: "p",
  mode: "direct",
  post_id: "1_2",
  lien_post: null,
  programme_pour: null,
  titre: "",
  message: "",
  refs: [],
  ventes_signalees: [],
  auteur: null,
  created_at: ilYA(1),
  ...o,
});

describe("filtres lus dans l'URL", () => {
  it("ignore les fenêtres hors liste, négatives ou illisibles", () => {
    for (const jours of ["-5", "0", "abc", "8", "1e9", ""]) {
      expect(filtresDepuisParams({ jours }).jours, jours).toBeUndefined();
    }
    expect(filtresDepuisParams({ jours: "14" }).jours).toBe(14);
  });

  it("dédoublonne les types et écarte les inconnus", () => {
    expect(filtresDepuisParams({ cat: ["trail", "trail", "<script>", "roadster"] }).categories).toEqual([
      "trail",
      "roadster",
    ]);
  });

  it("un paramètre répété ne garde que sa première valeur", () => {
    const f = filtresDepuisParams({ budget: ["5-10m", "plus-35m"], etat: ["neuf", "occasion"] });
    expect(f).toMatchObject({ budget: "5-10m", etat: "neuf" });
  });

  it("valeurs inconnues ignorées, recherche nettoyée et bornée", () => {
    const f = filtresDepuisParams({ budget: "gratuit", vente: "x", fraicheur: "x", q: "   " });
    expect(f).toMatchObject({ budget: undefined, vente: undefined, fraicheur: undefined, q: undefined });
    expect(filtresDepuisParams({ q: "a".repeat(500) }).q).toHaveLength(100);
  });
});

describe("motos proposées", () => {
  it("une moto réservée n'est jamais proposée, même si elle est « en vente »", () => {
    expect(estPromouvable("reserve")).toBe(false);
    expect(filtrerStudio([moto({ statut: "reserve" })], {}, {}, MAINTENANT)).toEqual([]);
  });

  it("aucun statut hors vente ne passe", () => {
    for (const statut of ["brouillon", "reserve", "vendu", "archive"] as const) {
      expect(filtrerStudio([moto({ statut })], {}, {}, MAINTENANT), statut).toEqual([]);
    }
  });

  it("la fenêtre de nouveauté inclut sa borne exacte", () => {
    const pile = moto({ created_at: ilYA(7) });
    const juste = moto({ created_at: new Date(MAINTENANT - 7 * JOUR - 1).toISOString() });
    expect(filtrerStudio([pile], { jours: 7 }, {}, MAINTENANT)).toHaveLength(1);
    expect(filtrerStudio([juste], { jours: 7 }, {}, MAINTENANT)).toHaveLength(0);
  });

  it("une moto programmée pour plus tard n'est pas « à remontrer »", () => {
    const h = historiqueParMoto([pub({ refs: ["MI-100"], mode: "programme", programme_pour: new Date(MAINTENANT + 3 * JOUR).toISOString() })]);
    expect(filtrerStudio([moto()], { fraicheur: "ancienne" }, h, MAINTENANT)).toEqual([]);
    expect(filtrerStudio([moto()], { fraicheur: "jamais" }, h, MAINTENANT)).toEqual([]);
  });

  it("la recherche exige chaque mot, sans tenir compte de la casse", () => {
    const l = [moto(), moto({ reference: "MI-200", marque: "Honda", modele: "CB500X" })];
    expect(filtrerStudio(l, { q: "HONDA cb500x" }, {}, MAINTENANT).map((m) => m.reference)).toEqual(["MI-200"]);
    expect(filtrerStudio(l, { q: "honda mt-07" }, {}, MAINTENANT)).toEqual([]);
  });

  it("budgets : zéro et les très gros prix tombent dans une tranche", () => {
    expect(dansBudget(0, "moins-5m")).toBe(true);
    expect(dansBudget(4_999_999, "moins-5m")).toBe(true);
    expect(dansBudget(5_000_000, "moins-5m")).toBe(false);
    expect(dansBudget(900_000_000, "plus-35m")).toBe(true);
  });
});

describe("sélection variée", () => {
  it("liste vide, ou plus petite que demandée", () => {
    expect(selectionVariee([], 6)).toEqual([]);
    expect(selectionVariee([moto()], 6)).toHaveLength(1);
  });

  it("une même marque écrite différemment compte pour une seule", () => {
    const l = [
      moto({ reference: "A", marque: "Yamaha", created_at: ilYA(1) }),
      moto({ reference: "B", marque: " yamaha ", created_at: ilYA(2) }),
      moto({ reference: "C", marque: "Honda", created_at: ilYA(3) }),
    ];
    expect(selectionVariee(l, 2).map((m) => m.reference).sort()).toEqual(["A", "C"]);
  });
});

describe("textes", () => {
  it("pas de kilométrage pour une neuve, ni quand il est inconnu ou nul", () => {
    expect(legendePhoto(moto({ etat: "neuf", kilometrage: 300 }), "c")).not.toMatch(/km/);
    expect(legendePhoto(moto({ kilometrage: null }), "c")).not.toMatch(/km/);
    expect(legendePhoto(moto({ kilometrage: 0 }), "c")).not.toMatch(/\d km/);
  });

  it("un titre vide ne laisse pas de ligne blanche en tête du post", () => {
    expect(legendeAlbum("   ", [moto()], "c").startsWith("1. ")).toBe(true);
  });

  it("le kit sans couverture ne la mentionne pas, et n'a aucun saut de ligne nu", () => {
    const t = texteKit({ titre: "", message: "a\nb", couverture: false, motos: [{ ref: "MI-100", legende: "x\ny" }] });
    expect(t).not.toContain("couverture");
    expect(t.replace(/\r\n/g, "")).not.toContain("\n");
  });
});

describe("album envoyé par l'écran", () => {
  const base = { titre: "T", message: "M", couverture: false, motos: [{ ref: "MI-100", legende: "" }] };

  it("refuse les doublons, l'album vide ou trop long", () => {
    expect(albumSchema.safeParse({ ...base, motos: [base.motos[0], base.motos[0]] }).success).toBe(false);
    expect(albumSchema.safeParse({ ...base, motos: [] }).success).toBe(false);
    const onze = Array.from({ length: MAX_ALBUM + 1 }, (_, i) => ({ ref: `MI-${100 + i}`, legende: "" }));
    expect(albumSchema.safeParse({ ...base, motos: onze }).success).toBe(false);
    expect(albumSchema.safeParse({ ...base, motos: onze.slice(0, MAX_ALBUM) }).success).toBe(true);
  });

  it("refuse un post vide (espaces seuls) et un titre trop long", () => {
    expect(albumSchema.safeParse({ ...base, message: "   \n " }).success).toBe(false);
    expect(albumSchema.safeParse({ ...base, titre: "x".repeat(MAX_TITRE + 1) }).success).toBe(false);
    expect(albumSchema.safeParse({ ...base, titre: "x".repeat(MAX_TITRE) }).success).toBe(true);
  });

  it("refuse les références mal formées et les types inattendus", () => {
    for (const ref of ["mi-100", "MI-1", "MI-100 ", "MI-100;DROP", ""]) {
      expect(albumSchema.safeParse({ ...base, motos: [{ ref, legende: "" }] }).success, ref).toBe(false);
    }
    expect(albumSchema.safeParse({ ...base, couverture: "oui" }).success).toBe(false);
    expect(albumSchema.safeParse(null).success).toBe(false);
  });
});

describe("programmation, à la seconde près", () => {
  it("les deux bornes exactes sont admises, un cheveu au-delà non", () => {
    expect(erreurProgrammation(new Date(MAINTENANT + PROGRAMMATION_MIN_MS), MAINTENANT)).toBeNull();
    expect(erreurProgrammation(new Date(MAINTENANT + PROGRAMMATION_MIN_MS - 1), MAINTENANT)).not.toBeNull();
    expect(erreurProgrammation(new Date(MAINTENANT + PROGRAMMATION_MAX_MS), MAINTENANT)).toBeNull();
    expect(erreurProgrammation(new Date(MAINTENANT + PROGRAMMATION_MAX_MS + 1), MAINTENANT)).not.toBeNull();
    expect(erreurProgrammation(new Date(MAINTENANT - JOUR), MAINTENANT)).not.toBeNull();
  });

  it("un post programmé dont l'heure est passée peut recevoir « VENDUE »", () => {
    const r = ventesASignaler(
      [pub({ refs: ["MI-1"], mode: "programme", programme_pour: new Date(MAINTENANT - 1000).toISOString() })],
      new Set(["MI-1"]),
      MAINTENANT
    );
    expect(r).toHaveLength(1);
  });

  it("rien à signaler quand tout est déjà annoncé", () => {
    expect(ventesASignaler([pub({ refs: ["MI-1"], ventes_signalees: ["MI-1"] })], new Set(["MI-1"]), MAINTENANT)).toEqual([]);
  });
});

describe("ZIP à plusieurs fichiers", () => {
  /** Relit l'archive par son répertoire central, comme le fait un extracteur. */
  function relire(zip: Uint8Array): Record<string, string> {
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const fin = zip.length - 22;
    expect(v.getUint32(fin, true)).toBe(0x06054b50);
    const n = v.getUint16(fin + 10, true);
    let c = v.getUint32(fin + 16, true);
    const fichiers: Record<string, string> = {};
    for (let i = 0; i < n; i++) {
      expect(v.getUint32(c, true)).toBe(0x02014b50);
      const taille = v.getUint32(c + 20, true);
      const lNom = v.getUint16(c + 28, true);
      const local = v.getUint32(c + 42, true);
      const nom = new TextDecoder().decode(zip.slice(c + 46, c + 46 + lNom));
      const debut = local + 30 + v.getUint16(local + 26, true);
      fichiers[nom] = new TextDecoder().decode(zip.slice(debut, debut + taille));
      c += 46 + lNom;
    }
    return fichiers;
  }

  it("chaque fichier se retrouve intact à son décalage, accents compris", () => {
    const binaire = new Uint8Array(70_000).map((_, i) => i % 251);
    const zip = creerZip([
      { nom: "légendes.txt", contenu: "été ✅" },
      { nom: "01-MI-100.png", contenu: binaire },
      { nom: "vide.txt", contenu: "" },
    ]);
    const f = relire(zip);
    expect(Object.keys(f)).toEqual(["légendes.txt", "01-MI-100.png", "vide.txt"]);
    expect(f["légendes.txt"]).toBe("été ✅");
    expect(f["01-MI-100.png"].length).toBeGreaterThan(0);
    expect(f["vide.txt"]).toBe("");
  });

  it("une archive vide reste une archive valide", () => {
    const zip = creerZip([]);
    expect(zip.length).toBe(22);
    expect(relire(zip)).toEqual({});
  });
});
