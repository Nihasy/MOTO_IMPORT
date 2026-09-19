import { beforeEach, describe, expect, it } from "vitest";
import { authentifier, signer, verifier } from "@/lib/auth";
import { hacherIp, limiterDebit, viderLimiteur } from "@/lib/securite";
import { controlesPublication } from "@/components/admin/controles-publication";
import { garantieCourte, garantieFiche } from "@/lib/garantie";
import { messageVerrou, verrouPublication } from "@/lib/publication";
import { motoSchema } from "@/lib/schemas";
import { estEnVente, estPublic } from "@/lib/types";
import type { Media, Moto } from "@/lib/types";

describe("authentification (12.3)", () => {
  it("accepte les identifiants d'un compte connu", () => {
    expect(authentifier("nihasy@moto-import.mg", "moto-import-2026")).toMatchObject({ role: "admin" });
  });

  it("refuse un mauvais mot de passe et un compte inconnu", () => {
    expect(authentifier("nihasy@moto-import.mg", "faux")).toBeNull();
    expect(authentifier("intrus@ailleurs.com", "moto-import-2026")).toBeNull();
  });

  it("distingue les rôles admin et éditeur", () => {
    expect(authentifier("editrice@moto-import.mg", "moto-import-2026")?.role).toBe("editeur");
  });

  it("signe et relit un jeton", () => {
    const jeton = signer({ email: "a@b.c", role: "admin" });
    expect(verifier(jeton)).toMatchObject({ email: "a@b.c", role: "admin" });
  });

  it("rejette un jeton falsifié, tronqué ou absent", () => {
    const jeton = signer({ email: "a@b.c", role: "admin" });
    const [charge] = jeton.split(".");
    expect(verifier(`${charge}.signature-bidon`)).toBeNull();
    expect(verifier(charge)).toBeNull();
    expect(verifier(undefined)).toBeNull();
  });

  it("rejette une élévation de privilège par réécriture de la charge utile", () => {
    const jeton = signer({ email: "a@b.c", role: "editeur" });
    const [, sig] = jeton.split(".");
    const forgee = Buffer.from(
      JSON.stringify({ email: "a@b.c", role: "admin", exp: Math.floor(Date.now() / 1000) + 999 })
    ).toString("base64url");
    expect(verifier(`${forgee}.${sig}`)).toBeNull();
  });
});

describe("hachage des adresses IP (12.3)", () => {
  it("ne conserve jamais l'IP en clair et reste déterministe", () => {
    const h = hacherIp("41.188.12.3");
    expect(h).not.toContain("41.188");
    expect(h).toHaveLength(32);
    expect(hacherIp("41.188.12.3")).toBe(h);
    expect(hacherIp("41.188.12.4")).not.toBe(h);
  });
});

describe("limitation de débit (11)", () => {
  beforeEach(() => viderLimiteur());

  it("autorise 5 requêtes puis bloque la sixième", () => {
    for (let i = 0; i < 5; i++) expect(limiterDebit("ip", 5).autorise).toBe(true);
    expect(limiterDebit("ip", 5).autorise).toBe(false);
  });

  it("compte séparément chaque clé", () => {
    for (let i = 0; i < 5; i++) limiterDebit("ip-a", 5);
    expect(limiterDebit("ip-b", 5).autorise).toBe(true);
  });
});

describe("contrôles bloquants avant publication (10.3)", () => {
  const moto = (o: Partial<Moto> = {}): Moto =>
    ({
      id: "1", reference: "MI-001", slug: "s", marque: "Honda", modele: "CB500X",
      annee: 2021, cylindree: 471, categorie: "trail", etat: "neuf", statut: "disponible",
      kilometrage: null, couleur: null, puissance_ch: null, poids_kg: null,
      hauteur_selle_mm: null, refroidissement: null, transmission: null, abs: false,
      prix_ttc: 12_500_000, prix_yuan: 10_000, taux_yuan: 670, acompte_pct: 50,
      prix_valable_jusqu_au: "2026-12-31",
      delai_min_jours: 45, delai_max_jours: 65, garantie_mois: 12, garantie_texte: "Moteur",
      description: Array(160).fill("mot").join(" "),
      points_forts: [], etat_details: null, date_photos: null, fournisseur_id: null,
      date_vente: null, vues: 0, created_at: "", updated_at: "",
      ...o,
    }) as Moto;

  const photo = (i: number, vue: Media["vue"]): Media => ({
    id: String(i), moto_id: "1", type: "photo", origine: "reelle", vue,
    cloudinary_id: "x", largeur: 1, hauteur: 1, blurhash: null,
    ordre: i, legende: null, alt: "alt", date_prise: null, created_at: "",
  });

  const planNeuf: Media["vue"][] = [
    "34_avant_droit", "profil_droit", "34_arriere_gauche", "face_avant",
    "compteur", "moteur", "pneu_avant", "pneu_arriere", "selle",
  ];

  it("bloque un plan de prise de vue incomplet, quel que soit le nombre de photos", () => {
    // Une seule des trois vues exigées : la couverture sans les autres angles.
    const c = controlesPublication(moto(), [photo(1, "34_avant_droit")]);
    expect(c.find((x) => x.libelle.startsWith("Plan de prise de vue"))?.ok).toBe(false);

    // Vingt clichés du même angle ne remplacent pas les vues absentes : c'est
    // la liste des angles qui est exigée, jamais un volume.
    const vingtFoisLeProfil = Array.from({ length: 20 }, (_, i) => photo(i + 1, "profil_droit"));
    const c2 = controlesPublication(moto(), vingtFoisLeProfil);
    expect(c2.find((x) => x.libelle.startsWith("Plan de prise de vue"))?.ok).toBe(false);
  });

  it("valide une fiche neuve complète", () => {
    const c = controlesPublication(moto(), planNeuf.map((v, i) => photo(i + 1, v)));
    expect(c.every((x) => x.ok)).toBe(true);
  });

  it("publie une fiche réduite aux trois angles exigés", () => {
    // Ni compteur, ni moteur, ni pneus, ni selle : ces vues sont facultatives
    // depuis l'allègement du plan, et leur absence ne bloque plus rien.
    const troisAngles: Media["vue"][] = ["34_avant_droit", "34_arriere_gauche", "face_avant"];
    const c = controlesPublication(moto(), troisAngles.map((v, i) => photo(i + 1, v)));
    expect(c.filter((x) => !x.ok)).toEqual([]);
  });

  it("publie une occasion sans vue du châssis", () => {
    const occasion = moto({ etat: "occasion", kilometrage: 12_000, date_photos: "2026-01-10", garantie_mois: 0, garantie_texte: null });
    const troisAngles: Media["vue"][] = ["34_avant_droit", "34_arriere_gauche", "face_avant"];
    const c = controlesPublication(occasion, troisAngles.map((v, i) => photo(i + 1, v)));
    expect(c.filter((x) => !x.ok)).toEqual([]);
  });

  it("bloque une occasion sans kilométrage ni date de photos", () => {
    const c = controlesPublication(moto({ etat: "occasion" }), []);
    expect(c.find((x) => x.libelle.includes("Kilométrage"))?.ok).toBe(false);
  });

  it("bloque une description vide, mais accepte un texte court", () => {
    const vide = controlesPublication(moto({ description: "   " }), []);
    expect(vide.find((x) => x.libelle.includes("Description"))?.ok).toBe(false);
    const court = controlesPublication(moto({ description: "Roadster japonais, deux mains." }), []);
    expect(court.find((x) => x.libelle.includes("Description"))?.ok).toBe(true);
  });

  it("bloque une photo sans texte alternatif", () => {
    const photos = planNeuf.map((v, i) => photo(i + 1, v));
    photos[3] = { ...photos[3], alt: "" };
    const c = controlesPublication(moto(), photos);
    expect(c.find((x) => x.libelle.includes("alternatif"))?.ok).toBe(false);
  });

  it("exige le 3/4 avant droit en couverture", () => {
    const photos = planNeuf.map((v, i) => photo(i + 1, v));
    const c = controlesPublication(moto(), [photos[1], ...photos.slice(2), photos[0]]);
    expect(c.find((x) => x.libelle.includes("couverture"))?.ok).toBe(false);
  });
});

describe("garantie : seul le neuf est couvert (CGV art. 8)", () => {
  const neuf = {
    reference: "MI-001", marque: "Honda", modele: "CB500X", annee: 2023, cylindree: 471,
    categorie: "trail", etat: "neuf", prix_ttc: 14_500_000,
    prix_valable_jusqu_au: "2026-12-31", description: "Une description.",
    garantie_mois: 12, garantie_texte: "Moteur et boîte",
  };
  const occasion = { ...neuf, etat: "occasion", kilometrage: 18_400, date_photos: "2026-08-01" };

  it("accepte une garantie sur un véhicule neuf", () => {
    expect(motoSchema.safeParse(neuf).success).toBe(true);
  });

  it("refuse une durée de garantie sur une occasion", () => {
    const r = motoSchema.safeParse({ ...occasion, garantie_texte: null });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["garantie_mois"]);
  });

  it("refuse un texte de garantie sur une occasion", () => {
    const r = motoSchema.safeParse({ ...occasion, garantie_mois: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["garantie_texte"]);
  });

  it("accepte une occasion vendue en l'état", () => {
    expect(motoSchema.safeParse({ ...occasion, garantie_mois: 0, garantie_texte: null }).success).toBe(true);
  });

  it("ne mentionne aucune garantie sur la fiche d'une occasion", () => {
    // Pas de ligne « sans garantie » : le silence, pas la case vide.
    expect(garantieFiche({ etat: "occasion", garantie_mois: 0, garantie_texte: null })).toBeNull();
    expect(garantieCourte({ etat: "occasion", garantie_mois: 0, garantie_texte: null })).toBeNull();
  });

  it("ne mentionne rien non plus sur un neuf dont la garantie n'est pas saisie", () => {
    expect(garantieFiche({ etat: "neuf", garantie_mois: 0, garantie_texte: null })).toBeNull();
    expect(garantieCourte({ etat: "neuf", garantie_mois: 0, garantie_texte: null })).toBeNull();
  });

  it("annonce la durée et les organes couverts sur la fiche d'un neuf", () => {
    const g = garantieFiche({ etat: "neuf", garantie_mois: 12, garantie_texte: "Moteur et boîte" });
    expect(g?.titre).toContain("12 mois");
    expect(g?.texte).toContain("Moteur et boîte");
    expect(g?.texte).toMatch(/marque et le concessionnaire/);
    expect(garantieCourte({ etat: "neuf", garantie_mois: 12, garantie_texte: "Moteur et boîte" }))
      .toBe("12 mois — Moteur et boîte");
  });

  it("exige la garantie avant publication d'un neuf, l'interdit sur une occasion", () => {
    const base = {
      id: "1", reference: "MI-001", slug: "s", marque: "Honda", modele: "CB500X",
      annee: 2023, cylindree: 471, categorie: "trail", statut: "disponible",
      couleur: null, puissance_ch: null, poids_kg: null, hauteur_selle_mm: null,
      refroidissement: null, transmission: null, abs: false, prix_ttc: 1,
      prix_valable_jusqu_au: "2026-12-31", delai_min_jours: 45, delai_max_jours: 65,
      description: "", points_forts: [], etat_details: null, fournisseur_id: null,
      date_vente: null, vues: 0, created_at: "", updated_at: "",
    };
    const ctrl = (m: Partial<Moto>) =>
      controlesPublication({ ...base, ...m } as Moto, []).find((c) =>
        c.libelle.toLowerCase().includes("garantie")
      );

    expect(ctrl({ etat: "neuf", kilometrage: null, date_photos: null, garantie_mois: 0, garantie_texte: null })?.ok).toBe(false);
    expect(ctrl({ etat: "neuf", kilometrage: null, date_photos: null, garantie_mois: 12, garantie_texte: "Moteur" })?.ok).toBe(true);
    expect(ctrl({ etat: "occasion", kilometrage: 1, date_photos: "2026-08-01", garantie_mois: 0, garantie_texte: null })?.ok).toBe(true);
    expect(ctrl({ etat: "occasion", kilometrage: 1, date_photos: "2026-08-01", garantie_mois: 6, garantie_texte: "Moteur" })?.ok).toBe(false);
  });
});

describe("verrou de publication (7.1, 10.3, recette 16.1)", () => {
  const fiche = (o: Partial<Moto> = {}): Moto =>
    ({
      id: "1", reference: "MI-001", slug: "s", marque: "Honda", modele: "CB500X",
      annee: 2023, cylindree: 471, categorie: "trail", etat: "neuf", statut: "brouillon",
      kilometrage: null, couleur: null, puissance_ch: null, poids_kg: null,
      hauteur_selle_mm: null, refroidissement: null, transmission: null, abs: false,
      prix_ttc: 12_500_000, prix_yuan: 10_000, taux_yuan: 670, acompte_pct: 50,
      prix_valable_jusqu_au: "2026-12-31",
      delai_min_jours: 45, delai_max_jours: 65, garantie_mois: 12, garantie_texte: "Moteur",
      description: Array(160).fill("mot").join(" "),
      points_forts: [], etat_details: null, date_photos: null, fournisseur_id: null,
      date_vente: null, vues: 0, created_at: "", updated_at: "",
      ...o,
    }) as Moto;

  const plan: Media["vue"][] = [
    "34_avant_droit", "profil_droit", "34_arriere_gauche", "face_avant",
    "compteur", "moteur", "pneu_avant", "pneu_arriere", "selle",
  ];
  const serie = (vues = plan): Media[] =>
    vues.map((vue, i) => ({
      id: String(i), moto_id: "1", type: "photo", origine: "reelle", vue,
      cloudinary_id: "x", largeur: 1, hauteur: 1, blurhash: null,
      ordre: i + 1, legende: null, alt: "alt", date_prise: null, created_at: "",
    }));

  it("refuse la mise en vente d'une fiche sans photo", () => {
    for (const cible of ["disponible", "dispo_immediate", "reserve"] as const) {
      const v = verrouPublication(fiche(), [], cible);
      expect(v.autorise).toBe(false);
      expect(v.bloquants.join(" ")).toMatch(/Plan de prise de vue complet/);
    }
  });

  it("autorise la mise en vente d'une fiche complète", () => {
    expect(verrouPublication(fiche(), serie(), "disponible").autorise).toBe(true);
  });

  it("refuse la mise en vente sans prix d'achat en yuan", () => {
    const v = verrouPublication(fiche({ prix_yuan: null, prix_ttc: 0 }), serie(), "disponible");
    expect(v.autorise).toBe(false);
    expect(v.bloquants.join(" ")).toMatch(/yuan/);
  });

  it("laisse toujours passer vendu, archive et le retour en brouillon", () => {
    for (const cible of ["vendu", "archive", "brouillon"] as const) {
      expect(verrouPublication(fiche(), [], cible).autorise).toBe(true);
    }
  });

  it("nomme chaque point bloquant dans le message", () => {
    const v = verrouPublication(fiche({ description: "" }), [], "disponible");
    const message = messageVerrou(v.bloquants);
    expect(message).toMatch(/Publication refusée/);
    expect(message).toMatch(/Description renseignée/);
  });

  it("garde brouillon et archive hors des surfaces publiques", () => {
    expect(estPublic("brouillon")).toBe(false);
    expect(estPublic("archive")).toBe(false);
    for (const s of ["dispo_immediate", "disponible", "reserve", "vendu"] as const) {
      expect(estPublic(s)).toBe(true);
    }
  });

  it("ne conditionne que les statuts qui proposent le véhicule", () => {
    expect(estEnVente("disponible")).toBe(true);
    expect(estEnVente("vendu")).toBe(false);
    expect(estEnVente("brouillon")).toBe(false);
  });
});
