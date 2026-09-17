import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `CLOUD_NAME` et `FILIGRANE_ID` sont lus à l'import du module : chaque cas
 * recharge donc `lib/cloudinary` après avoir posé son environnement.
 */
async function charger(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [cle, valeur] of Object.entries(env)) vi.stubEnv(cle, valeur ?? "");
  return import("@/lib/cloudinary");
}

afterEach(() => vi.unstubAllEnvs());

describe("filigrane servi par Cloudinary (7.5)", () => {
  const env = {
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "moto-import",
    NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID: "moto-import/filigrane",
  };

  it("incruste la marque sur une photo réelle", async () => {
    const { urlMedia, filigraneIncruste } = await charger(env);
    const url = urlMedia("motos/mi-047-01", "galerie", { origine: "reelle" });
    expect(url).toContain("l_moto-import:filigrane");
    expect(url).toContain("g_south_west");
    expect(filigraneIncruste("motos/mi-047-01", "galerie", { origine: "reelle" })).toBe(true);
  });

  it("épargne le visuel constructeur : la photo n'est pas de nous", async () => {
    const { urlMedia, filigraneIncruste } = await charger(env);
    const url = urlMedia("motos/mi-051-01", "galerie", { origine: "constructeur" });
    expect(url).not.toContain("l_moto-import:filigrane");
    expect(url).toContain("b_rgb:171C21");
    expect(filigraneIncruste("motos/mi-051-01", "galerie", { origine: "constructeur" })).toBe(false);
  });

  it("épargne la vignette du back-office, où la marque serait illisible", async () => {
    const { urlMedia, filigraneIncruste } = await charger(env);
    expect(urlMedia("motos/mi-047-01", "vignette", { origine: "reelle" })).not.toContain("l_moto");
    expect(filigraneIncruste("motos/mi-047-01", "vignette", { origine: "reelle" })).toBe(false);
  });

  it("se rabat sur un texte tant que le filigrane n'est pas téléversé", async () => {
    const { urlMedia } = await charger({ ...env, NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID: "" });
    const url = urlMedia("motos/mi-047-01", "plein", { origine: "reelle" });
    expect(url).toContain("l_text:Arial_28_bold:MOTO%20IMPORT");
    expect(url).toContain("g_south_west");
  });

  it("ne transforme ni une data URL ni un chemin servi par le site", async () => {
    const { urlMedia, filigraneIncruste } = await charger(env);
    const data = "data:image/webp;base64,AAAA";
    expect(urlMedia(data, "carte", { origine: "reelle" })).toBe(data);
    expect(filigraneIncruste(data, "carte", { origine: "reelle" })).toBe(false);
    // Les photos de démonstration vivent dans `public/` : les préfixer d'un
    // identifiant Cloudinary donnerait une URL à double barre.
    expect(urlMedia("/demo/1.jpeg", "carte", { origine: "reelle" })).toBe("/demo/1.jpeg");
    expect(filigraneIncruste("/demo/1.jpeg", "carte", { origine: "reelle" })).toBe(false);
  });
});

describe("filigrane sans Cloudinary", () => {
  const env = { NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "", NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID: "" };

  it("laisse l'URL intacte : aucune marque n'est dans les pixels servis", async () => {
    const { urlMedia, filigraneIncruste } = await charger(env);
    expect(urlMedia("/demo/1.jpeg", "carte", { origine: "reelle" })).toBe("/demo/1.jpeg");
    // L'interface doit donc poser la surcouche CSS elle-même.
    expect(filigraneIncruste("/demo/1.jpeg", "carte", { origine: "reelle" })).toBe(false);
  });

  it("réclame l'incrustation dès l'envoi, seule à survivre à un téléchargement", async () => {
    const { filigraneALEnvoi } = await charger(env);
    expect(filigraneALEnvoi("reelle")).toBe(true);
    expect(filigraneALEnvoi("constructeur")).toBe(false);
  });

  it("laisse Cloudinary faire quand il est branché : jamais deux marques", async () => {
    const { filigraneALEnvoi } = await charger({
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "moto-import",
      NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID: "moto-import/filigrane",
    });
    expect(filigraneALEnvoi("reelle")).toBe(false);
  });
});
