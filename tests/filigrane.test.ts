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

  /**
   * Décision de l'exploitant du 23/09/2026 : toutes nos images sortent marquées,
   * visuels constructeur compris. Le fond neutre qui leur est propre reste, lui,
   * une affaire de présentation et ne bouge pas.
   */
  it("marque aussi le visuel constructeur", async () => {
    const { urlMedia, filigraneIncruste } = await charger(env);
    const url = urlMedia("motos/mi-051-01", "galerie", { origine: "constructeur" });
    expect(url).toContain("l_moto-import:filigrane");
    expect(url).toContain("b_rgb:171C21");
    expect(filigraneIncruste("motos/mi-051-01", "galerie", { origine: "constructeur" })).toBe(true);
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
    expect(filigraneALEnvoi()).toBe(true);
  });

  it("laisse Cloudinary faire quand il est branché : jamais deux marques", async () => {
    const { filigraneALEnvoi } = await charger({
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "moto-import",
      NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID: "moto-import/filigrane",
    });
    expect(filigraneALEnvoi()).toBe(false);
  });
});

/**
 * Une photo déjà dimensionnée par Cloudinary ne doit pas repasser par
 * l'optimiseur de Vercel : double traitement, décompté sur son quota gratuit.
 */
describe("image déjà optimisée par Cloudinary", () => {
  it("est servie telle quelle quand Cloudinary la transforme", async () => {
    const { servieParCloudinary, urlMedia } = await charger({
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "moto-import",
    });
    expect(servieParCloudinary("moto-import/MI-047/photo")).toBe(true);
    expect(urlMedia("moto-import/MI-047/photo", "carte")).toMatch(/^https:\/\/res\.cloudinary\.com\//);
  });

  it("laisse les photos locales, data URL et adresses externes à next/image", async () => {
    const { servieParCloudinary } = await charger({ NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "moto-import" });
    expect(servieParCloudinary("/demo/1.jpeg")).toBe(false);
    expect(servieParCloudinary("data:image/webp;base64,AAAA")).toBe(false);
    expect(servieParCloudinary("https://exemple.com/photo.jpg")).toBe(false);
  });

  it("ne réclame rien sans Cloudinary configuré", async () => {
    const { servieParCloudinary } = await charger({ NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "" });
    expect(servieParCloudinary("moto-import/MI-047/photo")).toBe(false);
  });
});

describe("téléchargement des photos filigranées", () => {
  const env = {
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "moto-import",
    NEXT_PUBLIC_CLOUDINARY_FILIGRANE_ID: "moto-import/filigrane",
  };

  it("marque la photo réelle et l'annonce en pièce jointe", async () => {
    const { urlTelechargement } = await charger(env);
    const url = urlTelechargement("motos/mi-047-01", { origine: "reelle", nom: "mi-047-kove-400x-01" });
    expect(url).toContain("l_moto-import:filigrane");
    expect(url).toContain("fl_attachment:mi-047-kove-400x-01");
  });

  /**
   * L'attribut `download` d'un lien est ignoré sur un domaine tiers : sans
   * `fl_attachment`, le navigateur afficherait la photo au lieu de la
   * télécharger, et le bouton ne ferait rien d'utile.
   */
  it("porte toujours fl_attachment quand un nom est donné", async () => {
    const { urlTelechargement } = await charger(env);
    const url = urlTelechargement("motos/mi-051-01", { origine: "constructeur", nom: "mi-051-honda-01" });
    expect(url).toContain("fl_attachment:mi-051-honda-01");
  });

  it("marque le visuel constructeur, comme partout ailleurs", async () => {
    const { urlTelechargement } = await charger(env);
    const url = urlTelechargement("motos/mi-051-01", { origine: "constructeur", nom: "x" });
    expect(url).toContain("l_moto-import:filigrane");
  });

  /** Une pellicule de téléphone et Facebook lisent le JPEG partout. */
  it("force le JPEG plutôt que le format négocié de l'affichage", async () => {
    const { urlTelechargement } = await charger(env);
    const url = urlTelechargement("motos/mi-047-01", { origine: "reelle", nom: "x" });
    expect(url).toContain("f_jpg");
    expect(url).not.toContain("f_auto");
  });

  /**
   * Sans Cloudinary, la marque est incrustée dès l'envoi (`filigraneALEnvoi`) :
   * le fichier stocké la porte déjà, le servir tel quel ne perd rien.
   */
  it("sert le fichier tel quel quand Cloudinary n'est pas configuré", async () => {
    const { urlTelechargement } = await charger({ ...env, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "" });
    expect(urlTelechargement("/demo/1.jpeg", { origine: "reelle", nom: "x" })).toBe("/demo/1.jpeg");
  });
});

describe("nom du fichier téléchargé", () => {
  it("place la référence en tête et garde l'ordre de la galerie", async () => {
    const { nomTelechargement } = await import("@/lib/medias");
    expect(nomTelechargement("MI-047", "Kove", "400X Trois valises", 3)).toBe(
      "mi-047-kove-400x-trois-valises-03"
    );
  });

  it("aplatit les accents, qu'un système de fichiers rend mal", async () => {
    const { nomTelechargement } = await import("@/lib/medias");
    expect(nomTelechargement("MI-036", "Zhangxue", "500RR Monobras", 1)).toBe(
      "mi-036-zhangxue-500rr-monobras-01"
    );
  });
});
