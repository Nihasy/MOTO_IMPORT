import { describe, expect, it } from "vitest";
import {
  correspond, correspondTextes, decouper, normaliser, noteMot, rechercherMotos, surligner,
  trierParPertinence, type MotoIndexable,
} from "@/lib/recherche";
import { rechercheCatalogue } from "@/lib/catalogue";
import { appliquerFiltres } from "@/lib/db/filtres";
import type { MotoAvecMedias, Statut } from "@/lib/types";

let n = 0;
const moto = (o: Partial<MotoAvecMedias> = {}): MotoAvecMedias =>
  ({
    id: `id-${++n}`,
    reference: `MI-${String(n).padStart(3, "0")}`,
    slug: `moto-${n}`,
    marque: "Honda",
    modele: "CB500X",
    annee: 2022,
    cylindree: 471,
    categorie: "trail",
    etat: "occasion",
    statut: "disponible",
    kilometrage: 10000,
    couleur: "Rouge",
    puissance_ch: null,
    poids_kg: null,
    hauteur_selle_mm: null,
    refroidissement: "liquide",
    transmission: null,
    abs: true,
    prix_ttc: 20_000_000,
    acompte_pct: 60,
    prix_valable_jusqu_au: "2027-03-06",
    delai_min_jours: 45,
    delai_max_jours: 75,
    garantie_mois: 0,
    garantie_texte: null,
    description: "",
    points_forts: [],
    etat_details: null,
    date_photos: null,
    date_vente: null,
    vues: 0,
    created_at: `2026-10-${String((n % 28) + 1).padStart(2, "0")}T00:00:00Z`,
    updated_at: "2026-10-06T00:00:00Z",
    medias: [],
    ...o,
  }) as MotoAvecMedias;

const catalogue = [
  moto({ marque: "Honda", modele: "CB500X", cylindree: 471, categorie: "trail", annee: 2022 }),
  moto({ marque: "Honda", modele: "CB500F", cylindree: 471, categorie: "roadster", annee: 2023 }),
  moto({ marque: "Honda", modele: "CBR650R", cylindree: 649, categorie: "sportive", annee: 2021 }),
  moto({ marque: "Yamaha", modele: "MT-07", cylindree: 689, categorie: "roadster", annee: 2022, couleur: "Bleu" }),
  moto({ marque: "Kawasaki", modele: "Z900", cylindree: 948, categorie: "roadster", annee: 2021 }),
  moto({ marque: "BMW", modele: "R 1250 GS", cylindree: 1254, categorie: "trail", annee: 2020 }),
  moto({ marque: "Zuumav", modele: "K3-125D", cylindree: 124, categorie: "motocross", etat: "neuf", annee: 2026 }),
  moto({ marque: "Harley-Davidson", modele: "Fat Boy", cylindree: 1746, categorie: "custom", annee: 2018 }),
  moto({ marque: "QJMotor", modele: "SRK 600", cylindree: 600, categorie: "roadster", annee: 2022 }),
  moto({ marque: "CFMoto", modele: "650GT", cylindree: 649, categorie: "routiere", annee: 2022 }),
  moto({ marque: "Honda", modele: "Forza 350", cylindree: 330, categorie: "scooter", annee: 2025 }),
  moto({
    marque: "Kews", modele: "K16-NB300", cylindree: 280, categorie: "motocross", etat: "neuf", annee: 2026,
    description: "Moteur Zongshen NB300, train avant réglable.",
  }),
];

const modeles = (q: string) => rechercherMotos(catalogue, q).trouvees.map((t) => t.moto.modele);

describe("normalisation", () => {
  it("retire accents, casse et ponctuation", () => {
    expect(normaliser("Routière  ÉTÉ")).toBe("routiere ete");
    expect(normaliser("CB-500X")).toBe("cb 500x");
    expect(normaliser("650 cm³")).toBe("650 cm3");
  });

  it("écarte les mots qui ne désignent rien", () => {
    expect(decouper("une moto Honda pour la route")).toEqual(["honda", "route"]);
    expect(decouper("MI-177")).toEqual(["177"]);
    expect(decouper("moto")).toEqual([]);
  });

  it("borne la requête à huit mots", () => {
    expect(decouper("a1 b2 c3 d4 e5 f6 g7 h8 i9 j10")).toHaveLength(8);
  });
});

describe("tolérance aux fautes", () => {
  it("retrouve une marque mal tapée", () => {
    expect(modeles("kawazaki")).toEqual(["Z900"]);
    expect(modeles("yamha")).toEqual(["MT-07"]);
    expect(modeles("hnda").length).toBe(4);
    expect(modeles("harlay")).toEqual(["Fat Boy"]);
  });

  it("ne tolère aucune faute sur un nombre", () => {
    expect(noteMot("2022", "2023")).toBe(0);
    expect(modeles("2018")).toEqual(["Fat Boy"]);
  });

  it("ne rapproche pas les mots des textes longs à une lettre près", () => {
    // « trail » ne doit pas trouver « train » dans la description de la Kews.
    expect(modeles("trail")).toEqual(["CB500X", "R 1250 GS"]);
  });
});

describe("formes d'écriture des modèles", () => {
  it.each(["cb500x", "CB500X", "cb 500 x", "CB-500X", "cb500 x"])("« %s » trouve la CB500X", (q) => {
    expect(modeles(q)[0]).toBe("CB500X");
  });

  it.each(["mt07", "MT-07", "mt 07", "mt"])("« %s » trouve la MT-07", (q) => {
    expect(modeles(q)).toContain("MT-07");
  });

  it("trouve un modèle par son début", () => {
    expect(modeles("cb500").sort()).toEqual(["CB500F", "CB500X"]);
    expect(modeles("r1250")).toEqual(["R 1250 GS"]);
    expect(modeles("r 1250 gs")).toEqual(["R 1250 GS"]);
  });

  it("place en tête le modèle tapé en entier", () => {
    expect(modeles("cb500x")[0]).toBe("CB500X");
    expect(modeles("honda cb")[0]).toMatch(/^CB/);
  });
});

describe("nombres : cylindrée, année, référence", () => {
  it("« 125 » trouve la 125 sans remonter la R 1250 GS", () => {
    expect(modeles("125")).toEqual(["K3-125D"]);
  });

  it("trouve la cylindrée commerciale d'une cylindrée réelle", () => {
    expect(modeles("650").sort()).toEqual(["650GT", "CBR650R"]);
    expect(modeles("650cc").sort()).toEqual(["650GT", "CBR650R"]);
    expect(modeles("650 cm3").sort()).toEqual(["650GT", "CBR650R"]);
  });

  it("trouve une fiche par sa référence, sous toutes ses formes", () => {
    const ref = catalogue[4].reference; // Z900
    const num = ref.slice(3);
    for (const q of [ref, ref.toLowerCase(), ref.replace("-", ""), num]) {
      expect(modeles(q)).toEqual(["Z900"]);
    }
  });
});

describe("types, état et surnoms", () => {
  it("reconnaît les noms courants des types", () => {
    expect(modeles("naked").sort()).toEqual(["CB500F", "MT-07", "SRK 600", "Z900"]);
    expect(modeles("adventure").sort()).toEqual(["CB500X", "R 1250 GS"]);
    expect(modeles("cruiser")).toEqual(["Fat Boy"]);
    expect(modeles("enduro").sort()).toEqual(["K16-NB300", "K3-125D"]);
    expect(modeles("scoter")).toEqual(["Forza 350"]);
    expect(modeles("routière")).toEqual(["650GT"]);
  });

  it("reconnaît neuf et occasion, au féminin aussi", () => {
    expect(modeles("neuve").sort()).toEqual(["K16-NB300", "K3-125D"]);
    expect(modeles("cross neuf").sort()).toEqual(["K16-NB300", "K3-125D"]);
  });

  it("reconnaît les surnoms et les noms en deux mots", () => {
    expect(modeles("hd")).toEqual(["Fat Boy"]);
    expect(modeles("qj")).toEqual(["SRK 600"]);
    expect(modeles("QJ Motor")).toEqual(["SRK 600"]);
    expect(modeles("cf moto")).toEqual(["650GT"]);
  });

  it("cherche aussi la couleur", () => {
    expect(modeles("yamaha bleue")).toEqual(["MT-07"]);
  });
});

describe("recherche stricte et repli approximatif", () => {
  it("restreint quand on ajoute des mots", () => {
    expect(modeles("honda 2023")).toEqual(["CB500F"]);
  });

  it("se replie sur les plus proches et le signale", () => {
    const r = rechercherMotos(catalogue, "honda ducati");
    expect(r.approximatif).toBe(true);
    expect(r.trouvees.every((t) => t.moto.marque === "Honda")).toBe(true);
  });

  it("ne rend rien quand rien n'approche", () => {
    const r = rechercherMotos(catalogue, "zzzzqqq");
    expect(r.trouvees).toHaveLength(0);
    expect(r.approximatif).toBe(false);
  });

  it("laisse passer tout le catalogue sans texte", () => {
    expect(rechercherMotos(catalogue, "  ").trouvees).toHaveLength(catalogue.length);
    expect(rechercherMotos(catalogue, undefined).approximatif).toBe(false);
  });
});

describe("champs internes", () => {
  it("n'indexe jamais le fournisseur ni le prix d'achat", () => {
    const interne = { ...catalogue[0], fournisseur_id: "CROSS_TAO", prix_yuan: 77777 } as MotoIndexable;
    expect(correspond(interne, "CROSS_TAO")).toBe(false);
    expect(correspond(interne, "77777")).toBe(false);
  });
});

describe("tri par pertinence", () => {
  it("garde le statut en premier critère", () => {
    const vendue = moto({ modele: "CB500X", statut: "vendu" as Statut });
    const dispo = moto({ modele: "CB500F", statut: "disponible" as Statut });
    const notes = new Map([[vendue.id, 10], [dispo.id, 1]]);
    expect(trierParPertinence([vendue, dispo], (m) => notes.get(m.id)!)[0]).toBe(dispo);
  });
});

describe("sélection du catalogue", () => {
  const lire = (p: Record<string, string>) => (k: string) => p[k];

  it("trie par pertinence dès qu'il y a du texte", () => {
    const r = rechercheCatalogue(catalogue, lire({ q: "cb500x" }));
    expect(r.tri).toBe("pertinence");
    expect(r.motos[0].modele).toBe("CB500X");
  });

  it("respecte un tri demandé malgré le texte", () => {
    const r = rechercheCatalogue(catalogue, lire({ q: "honda", tri: "annee", ordre: "asc" }));
    expect(r.tri).toBe("annee");
    expect(r.motos.map((m) => m.annee)).toEqual([2021, 2022, 2023, 2025]);
  });

  it("ignore la pertinence sans texte", () => {
    expect(rechercheCatalogue(catalogue, lire({ tri: "pertinence" })).tri).toBe("date");
  });

  it("cumule texte et filtres, et compte les correspondantes avant filtres", () => {
    const r = rechercheCatalogue(catalogue, lire({ q: "honda", cat: "trail" }));
    expect(r.motos.map((m) => m.modele)).toEqual(["CB500X"]);
    expect(r.correspondantes).toHaveLength(4);
  });

  it("ne se replie pas quand ce sont les filtres qui vident la liste", () => {
    const r = rechercheCatalogue(catalogue, lire({ q: "honda", max: "1000" }));
    expect(r.motos).toHaveLength(0);
    expect(r.approximatif).toBe(false);
  });

  it("annonce le repli approximatif", () => {
    const r = rechercheCatalogue(catalogue, lire({ q: "kawasaki ducati" }));
    expect(r.approximatif).toBe(true);
    expect(r.motos.map((m) => m.modele)).toEqual(["Z900"]);
  });

  it("garde la recherche stricte dans appliquerFiltres", () => {
    expect(appliquerFiltres(catalogue, { recherche: "honda ducati" })).toHaveLength(0);
  });
});

describe("back-office", () => {
  it("cherche sur des textes quelconques", () => {
    expect(correspondTextes(["MI-901", "Suzuki", "GSX-S750", "2019"], "gsxs750")).toBe(true);
    expect(correspondTextes(["MI-901", "Suzuki", "GSX-S750", "2019"], "GSX-S750")).toBe(true);
    expect(correspondTextes(["MI-001", "Yamaha", "MT-07", "2022"], "GSX-S750")).toBe(false);
  });
});

describe("surlignage", () => {
  it("marque les mots trouvés", () => {
    const parts = surligner("Honda CB500X", decouper("cb500"));
    expect(parts.filter((p) => p.trouve).map((p) => p.texte)).toEqual(["CB500X"]);
  });

  it("ne marque rien sans requête", () => {
    expect(surligner("Honda", [])).toEqual([{ texte: "Honda", trouve: false }]);
  });

  it("marque une marque mal tapée", () => {
    expect(surligner("Kawasaki Z900", decouper("kawazaki"))[0]).toEqual({ texte: "Kawasaki", trouve: true });
  });
});

describe("suggestions de la boîte de recherche", () => {
  // Import tardif : `suggerer` lit la configuration Cloudinary au chargement.
  const charger = async () => (await import("@/lib/suggestions")).suggerer;

  it("ne transporte que des champs publics, explicitement choisis", async () => {
    const suggerer = await charger();
    const interne = {
      ...catalogue[0], fournisseur_id: "CROSS_TAO", prix_yuan: 12345, marge_ar: 1, volume_m3: 0.7,
    } as unknown as MotoAvecMedias;
    const s = suggerer([interne], "cb500x");
    expect(Object.keys(s.motos[0]).sort()).toEqual(
      ["annee", "cylindree", "etat", "marque", "modele", "photo", "prix_ttc", "slug", "statut"].sort()
    );
    expect(JSON.stringify(s)).not.toMatch(/CROSS_TAO|12345|prix_yuan|fournisseur|marge|volume/);
  });

  it("n'affiche jamais un brouillon ni une fiche archivée", async () => {
    const suggerer = await charger();
    const cachees = [
      moto({ modele: "Secret 1", statut: "brouillon" as Statut }),
      moto({ modele: "Secret 2", statut: "archive" as Statut }),
    ];
    expect(suggerer(cachees, "secret").total).toBe(0);
  });

  it("propose une marque ou un type quand ils répondent à toute la requête", async () => {
    const suggerer = await charger();
    expect(suggerer(catalogue, "kaw").marques).toEqual([{ nom: "Kawasaki", effectif: 1 }]);
    expect(suggerer(catalogue, "naked").categories).toEqual([{ cle: "roadster", libelle: "Roadster", effectif: 4 }]);
    expect(suggerer(catalogue, "honda cb").marques).toEqual([]);
  });

  it("limite la liste à six motos mais compte toutes les correspondances", async () => {
    const suggerer = await charger();
    const nombreuses = Array.from({ length: 9 }, (_, i) => moto({ modele: `CB${i}00` }));
    const s = suggerer(nombreuses, "honda");
    expect(s.motos).toHaveLength(6);
    expect(s.total).toBe(9);
  });

  it("ne suggère rien sans mot utile", async () => {
    const suggerer = await charger();
    expect(suggerer(catalogue, "moto").total).toBe(0);
    expect(suggerer(catalogue, "").motos).toEqual([]);
  });

  it("annonce une miniature à marquer par-dessus quand Cloudinary ne la pose pas", async () => {
    const suggerer = await charger();
    const avecPhoto = moto({
      medias: [{
        id: "p", moto_id: "x", type: "photo", origine: "reelle", vue: "34_avant_droit", cloudinary_id: "/demo/1.jpeg",
        largeur: 1, hauteur: 1, blurhash: null, ordre: 1, legende: null, alt: "", date_prise: null, created_at: "",
      }],
    });
    const photo = suggerer([avecPhoto], "honda").motos[0].photo!;
    expect(photo.src).toBe("/demo/1.jpeg");
    expect(photo.marquee).toBe(false);
  });
});
