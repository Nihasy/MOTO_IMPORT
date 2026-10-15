import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contrat d'appel à l'API Graph, éprouvé contre un faux `fetch` : on ne publie
 * pas sur la vraie page pour tester. Ce qui compte ici, c'est la forme exacte
 * des requêtes — Facebook ne pardonne ni un champ manquant ni un ordre faux, et
 * l'erreur n'apparaît qu'en production.
 */
vi.mock("server-only", () => ({}));

type Appel = { url: string; corps: FormData };
type Reponse = { status?: number; json: unknown };
let appels: Appel[];
let reponses: ((a: Appel) => Reponse)[];

beforeEach(() => {
  appels = [];
  reponses = [];
  process.env.FACEBOOK_PAGE_ID = "PAGE";
  process.env.FACEBOOK_PAGE_TOKEN = "JETON-SECRET";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body: FormData }) => {
      const a = { url, corps: init.body };
      appels.push(a);
      const r: Reponse = (reponses.shift() ?? (() => ({ json: { id: `id-${appels.length}` } })))(a);
      return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FACEBOOK_PAGE_ID;
  delete process.env.FACEBOOK_PAGE_TOKEN;
});

const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ png: new ArrayBuffer(8), legende: `L${i}`, nom: `${i}.png` }));

describe("API Graph : publication d'un album", async () => {
  const { facebookConfigure, publierAlbum, commenter } = await import("@/lib/facebook-graph");

  it("n'est configurée qu'avec la page ET le jeton", () => {
    expect(facebookConfigure()).toBe(true);
    process.env.FACEBOOK_PAGE_TOKEN = "";
    expect(facebookConfigure()).toBe(false);
  });

  it("téléverse chaque photo non publiée avec sa légende, puis un seul post qui les attache dans l'ordre", async () => {
    const r = await publierAlbum({ message: "Post", photos: photos(3) });
    expect(appels).toHaveLength(4);
    appels.slice(0, 3).forEach((a, i) => {
      expect(a.url).toMatch(/\/PAGE\/photos$/);
      expect(a.corps.get("published")).toBe("false");
      expect(a.corps.get("caption")).toBe(`L${i}`);
      expect(a.corps.get("temporary")).toBeNull();
      expect(a.corps.get("source")).toBeInstanceOf(Blob);
    });
    const feed = appels[3];
    expect(feed.url).toMatch(/\/PAGE\/feed$/);
    expect(feed.corps.get("message")).toBe("Post");
    expect([0, 1, 2].map((i) => JSON.parse(String(feed.corps.get(`attached_media[${i}]`))).media_fbid)).toEqual([
      "id-1",
      "id-2",
      "id-3",
    ]);
    expect(feed.corps.get("published")).toBeNull();
    expect(r).toEqual({ postId: "id-4", lien: "https://www.facebook.com/id-4" });
  });

  it("le jeton ne passe jamais dans l'URL", async () => {
    await publierAlbum({ message: "Post", photos: photos(1) });
    for (const a of appels) {
      expect(a.url).not.toContain("JETON-SECRET");
      expect(a.corps.get("access_token")).toBe("JETON-SECRET");
    }
  });

  it("programmé : photos temporaires, post non publié avec l'heure en secondes Unix", async () => {
    const quand = new Date("2026-10-20T15:30:45.900Z");
    await publierAlbum({ message: "Post", photos: photos(2), programmeLe: quand });
    expect(appels[0].corps.get("temporary")).toBe("true");
    expect(appels[1].corps.get("temporary")).toBe("true");
    expect(appels[2].corps.get("published")).toBe("false");
    expect(appels[2].corps.get("scheduled_publish_time")).toBe(String(Math.floor(quand.getTime() / 1000)));
  });

  it("une photo refusée arrête tout avant le post, avec le message de Facebook", async () => {
    reponses = [
      () => ({ json: { id: "ok" } }),
      () => ({ status: 400, json: { error: { message: "(#100) Invalid image", code: 100 } } }),
    ];
    await expect(publierAlbum({ message: "Post", photos: photos(3) })).rejects.toThrow(/Invalid image/);
    expect(appels).toHaveLength(2);
    expect(appels.some((a) => a.url.endsWith("/feed"))).toBe(false);
  });

  it("une erreur sans corps lisible reste explicite", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    await expect(publierAlbum({ message: "Post", photos: photos(1) })).rejects.toThrow(/HTTP 502/);
  });

  it("une réponse 200 portant une erreur est traitée comme un échec", async () => {
    reponses = [() => ({ status: 200, json: { error: { message: "Session expirée" } } })];
    await expect(publierAlbum({ message: "Post", photos: photos(1) })).rejects.toThrow(/Session expirée/);
  });

  it("sans configuration, refuse avant le moindre appel", async () => {
    delete process.env.FACEBOOK_PAGE_ID;
    await expect(publierAlbum({ message: "Post", photos: photos(1) })).rejects.toThrow(/non configurée/);
    expect(appels).toHaveLength(0);
  });

  it("le commentaire vise le post et porte le texte", async () => {
    await commenter("PAGE_42", "✅ VENDUE");
    expect(appels[0].url).toMatch(/\/PAGE_42\/comments$/);
    expect(appels[0].corps.get("message")).toBe("✅ VENDUE");
  });
});
