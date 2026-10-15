import { describe, expect, it } from "vitest";
import {
  BUDGETS, albumSchema, commentaireVente, dansBudget, erreurProgrammation, filtrerStudio,
  historiqueParMoto, legendeAlbum, legendePhoto, lienFiche, mentionVente, selectionVariee,
  texteKit, titreSuggere, ventesASignaler, type LigneStudio,
} from "@/lib/facebook";
import { DELAI_MAX, DELAI_MIN } from "@/lib/conditions";
import { crc32, creerZip } from "@/lib/zip";
import type { Media, PublicationFb } from "@/lib/types";

const MAINTENANT = new Date("2026-10-15T12:00:00Z").getTime();
const JOUR = 86_400_000;
const ilYA = (jours: number) => new Date(MAINTENANT - jours * JOUR).toISOString();

const photo = { id: "p", cloudinary_id: "moto-import/x", origine: "reelle" } as Media;

const moto = (o: Partial<LigneStudio> = {}): LigneStudio => ({
  id: o.reference ?? "MI-100",
  reference: "MI-100",
  slug: "yamaha-mt-07-2021-mi-100",
  marque: "Yamaha",
  modele: "MT-07",
  annee: 2021,
  cylindree: 689,
  categorie: "roadster",
  etat: "occasion",
  statut: "disponible",
  kilometrage: 12000,
  prix_ttc: 18_500_000,
  created_at: ilYA(3),
  mise_en_vente: "commande",
  couverture: photo,
  ...o,
});

const pub = (o: Partial<PublicationFb> = {}): PublicationFb => ({
  id: "pub-1",
  mode: "direct",
  post_id: "123_456",
  lien_post: null,
  programme_pour: null,
  titre: "Album",
  message: "",
  refs: [],
  ventes_signalees: [],
  auteur: null,
  created_at: ilYA(5),
  ...o,
});

describe("Studio Facebook : budgets", () => {
  it("les tranches se suivent sans trou ni chevauchement", () => {
    for (let i = 1; i < BUDGETS.length; i++) expect(BUDGETS[i].min).toBe(BUDGETS[i - 1].max);
    expect(BUDGETS[0].min).toBe(0);
    expect(BUDGETS.at(-1)!.max).toBe(Infinity);
  });

  it("une borne tombe dans une seule tranche, la haute", () => {
    expect(BUDGETS.filter((b) => dansBudget(10_000_000, b.cle)).map((b) => b.cle)).toEqual(["10-20m"]);
  });
});

describe("Studio Facebook : filtres", () => {
  it("ne propose que des motos en vente, avec photo et prix", () => {
    const lignes = [
      moto({ reference: "MI-1" }),
      moto({ reference: "MI-2", statut: "vendu" }),
      moto({ reference: "MI-3", statut: "brouillon" }),
      moto({ reference: "MI-4", couverture: null }),
      moto({ reference: "MI-5", prix_ttc: 0 }),
      moto({ reference: "MI-6", statut: "dispo_immediate" }),
    ];
    expect(filtrerStudio(lignes, {}, {}, MAINTENANT).map((m) => m.reference)).toEqual(["MI-1", "MI-6"]);
  });

  it("combine nouveautés, type, budget, état et disponibilité", () => {
    const lignes = [
      moto({ reference: "MI-1" }),
      moto({ reference: "MI-2", created_at: ilYA(20) }),
      moto({ reference: "MI-3", categorie: "trail" }),
      moto({ reference: "MI-4", prix_ttc: 4_000_000 }),
      moto({ reference: "MI-5", etat: "neuf" }),
      moto({ reference: "MI-6", mise_en_vente: "local" }),
    ];
    const r = filtrerStudio(
      lignes,
      { jours: 7, categories: ["roadster"], budget: "10-20m", etat: "occasion", vente: "commande" },
      {},
      MAINTENANT
    );
    expect(r.map((m) => m.reference)).toEqual(["MI-1"]);
  });

  it("« jamais publiée » et « pas depuis 30 jours » lisent le journal", () => {
    const lignes = [moto({ reference: "MI-1" }), moto({ reference: "MI-2" }), moto({ reference: "MI-3" })];
    const h = historiqueParMoto([
      pub({ refs: ["MI-1"], created_at: ilYA(5) }),
      pub({ refs: ["MI-2"], created_at: ilYA(45) }),
    ]);
    expect(filtrerStudio(lignes, { fraicheur: "jamais" }, h, MAINTENANT).map((m) => m.reference)).toEqual(["MI-3"]);
    expect(
      filtrerStudio(lignes, { fraicheur: "ancienne" }, h, MAINTENANT).map((m) => m.reference).sort()
    ).toEqual(["MI-2", "MI-3"]);
  });

  it("l'historique compte les passages et garde la date la plus récente", () => {
    const h = historiqueParMoto([
      pub({ refs: ["MI-1"], created_at: ilYA(40) }),
      pub({ refs: ["MI-1"], created_at: ilYA(2) }),
      pub({ refs: ["MI-1"], created_at: ilYA(10) }),
    ]);
    expect(h["MI-1"]).toEqual({ nb: 3, derniere: ilYA(2) });
  });
});

describe("Studio Facebook : sélection variée", () => {
  it("tourne entre les marques puis range par prix", () => {
    const lignes = [
      moto({ reference: "Y1", marque: "Yamaha", prix_ttc: 30, created_at: ilYA(1) }),
      moto({ reference: "Y2", marque: "Yamaha", prix_ttc: 10, created_at: ilYA(2) }),
      moto({ reference: "Y3", marque: "Yamaha", prix_ttc: 5, created_at: ilYA(3) }),
      moto({ reference: "H1", marque: "Honda", prix_ttc: 20, created_at: ilYA(4) }),
      moto({ reference: "K1", marque: "kawasaki", prix_ttc: 40, created_at: ilYA(5) }),
    ];
    expect(selectionVariee(lignes, 4).map((m) => m.reference)).toEqual(["Y2", "H1", "Y1", "K1"]);
  });
});

describe("Studio Facebook : textes", () => {
  it("le lien porte la source Facebook lue par l'attribution des demandes, et la référence", () => {
    const u = new URL(lienFiche(moto(), "album-20261015"));
    expect(u.pathname).toBe("/motos/yamaha-mt-07-2021-mi-100");
    expect(u.searchParams.get("utm_source")).toBe("facebook");
    expect(u.searchParams.get("utm_campaign")).toBe("album-20261015");
    expect(u.searchParams.get("utm_content")).toBe("MI-100");
  });

  it("une moto sur commande n'est jamais dite à Tana, et le délai suit les conditions", () => {
    const m = mentionVente(moto());
    expect(m).not.toMatch(/Tana/);
    expect(m).toContain(`${DELAI_MIN} ka hatramin'ny ${DELAI_MAX} andro`);
    expect(mentionVente(moto({ mise_en_vente: "local" }))).toMatch(/disponible de suite/);
  });

  it("la légende d'une photo donne modèle, prix, référence et lien", () => {
    const l = legendePhoto(moto(), "c");
    expect(l).toContain("Yamaha MT-07 2021");
    expect(l).toMatch(/12\s000 km/);
    expect(l).toMatch(/18\s500\s000\sAr/);
    expect(l).toContain("Réf. MI-100");
    expect(l).toContain("utm_content=MI-100");
  });

  it("le texte du post numérote les motos avec leur lien", () => {
    const t = legendeAlbum("Roadsters", [moto(), moto({ reference: "MI-101", slug: "b", mise_en_vente: "local" })], "c");
    expect(t.startsWith("Roadsters")).toBe(true);
    expect(t).toContain("1. Yamaha MT-07 2021");
    expect(t).toContain("2. Yamaha MT-07 2021");
    expect(t).toContain("utm_content=MI-101");
    expect(t).toContain("Jereo ny catalogue");
  });

  it("sans moto sur commande, le texte ne parle pas de délai", () => {
    expect(legendeAlbum("T", [moto({ mise_en_vente: "local" })], "c")).not.toContain("andro");
  });

  it("le titre suggéré reprend les filtres", () => {
    expect(titreSuggere({ jours: 7, categories: ["trail"], budget: "5-10m" })).toBe(
      "Nouveautés · Trails de 5 à 10 M Ar"
    );
    expect(titreSuggere({})).toBe("Motos");
    expect(titreSuggere({ categories: ["motocross"], etat: "neuf" })).toBe("Cross neuves");
  });
});

describe("Studio Facebook : programmation et ventes", () => {
  it("respecte la fenêtre de l'API : 10 minutes à 30 jours", () => {
    expect(erreurProgrammation(new Date(MAINTENANT + 5 * 60_000), MAINTENANT)).toMatch(/10 minutes/);
    expect(erreurProgrammation(new Date(MAINTENANT + 60 * 60_000), MAINTENANT)).toBeNull();
    expect(erreurProgrammation(new Date(MAINTENANT + 31 * JOUR), MAINTENANT)).toMatch(/30 jours/);
    expect(erreurProgrammation(new Date("x"), MAINTENANT)).toMatch(/illisible/);
  });

  it("annonce une vente une seule fois, et seulement sur un post en ligne passé par l'API", () => {
    const vendues = new Set(["MI-1", "MI-2", "MI-3"]);
    const r = ventesASignaler(
      [
        pub({ id: "a", refs: ["MI-1", "MI-2", "MI-9"], ventes_signalees: ["MI-1"] }),
        pub({ id: "b", refs: ["MI-3"], post_id: null, mode: "manuel" }),
        pub({ id: "c", refs: ["MI-3"], mode: "programme", programme_pour: new Date(MAINTENANT + JOUR).toISOString() }),
        pub({ id: "d", refs: ["MI-9"] }),
      ],
      vendues,
      MAINTENANT
    );
    expect(r.map((v) => [v.publication.id, v.refs])).toEqual([["a", ["MI-2"]]]);
  });

  it("le commentaire nomme chaque moto vendue", () => {
    const c = commentaireVente([moto(), moto({ reference: "MI-2", modele: "Tracer 9" })]);
    expect(c).toContain("VENDUES");
    expect(c).toContain("MT-07 (réf. MI-100)");
    expect(c).toContain("Tracer 9 (réf. MI-2)");
  });
});

describe("Studio Facebook : album et kit", () => {
  const album = {
    titre: "T",
    message: "Post",
    couverture: true,
    motos: [{ ref: "MI-100", legende: "L1" }],
  };

  it("valide un album et refuse une référence forgée", () => {
    expect(albumSchema.safeParse(album).success).toBe(true);
    expect(albumSchema.safeParse({ ...album, motos: [{ ref: "../x", legende: "" }] }).success).toBe(false);
    expect(albumSchema.safeParse({ ...album, motos: [] }).success).toBe(false);
  });

  it("le texte du kit suit l'ordre des fichiers", () => {
    const t = texteKit(album);
    expect(t.indexOf("00-couverture.png")).toBeLessThan(t.indexOf("01-MI-100.png"));
    expect(t).toContain("\r\nL1");
  });

  it("le ZIP se relit : signatures, CRC et contenu", () => {
    const zip = creerZip([{ nom: "légende.txt", contenu: "bonjour" }]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const nomLong = v.getUint16(26, true);
    const donnees = zip.slice(30 + nomLong, 30 + nomLong + v.getUint32(18, true));
    expect(new TextDecoder().decode(donnees)).toBe("bonjour");
    expect(v.getUint32(14, true)).toBe(crc32(new TextEncoder().encode("bonjour")));
    expect(v.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    // CRC32 de référence de « 123456789 ».
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});
