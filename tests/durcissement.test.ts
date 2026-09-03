import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { jsonLdSecurise } from "@/lib/jsonld";
import { destinationSure } from "@/lib/auth";
import {
  hacherIp,
  ipDepuisEntetes,
  limiterDebit,
  limiterDebitDouble,
  tailleLimiteur,
  viderLimiteur,
} from "@/lib/securite";

/** `NODE_ENV` est declare en lecture seule : on ecrit via la description. */
const definirEnv = (cle: string, valeur: string) => {
  Object.defineProperty(process.env, cle, { value: valeur, configurable: true, writable: true });
};

const envInitial = { ...process.env };
afterEach(() => {
  process.env = { ...envInitial };
});

describe("donnees structurees inserees dans un <script>", () => {
  it("neutralise une fermeture de balise script", () => {
    const sortie = jsonLdSecurise({ d: "</script><script>alert(1)</script>" });
    expect(sortie).not.toContain("</script");
    expect(sortie).not.toContain("<script");
  });

  it("echappe aussi < > et &", () => {
    const sortie = jsonLdSecurise({ d: "<a & b>" });
    expect(sortie).not.toMatch(/[<>&]/);
  });

  it("echappe les separateurs de ligne U+2028 et U+2029", () => {
    const sortie = jsonLdSecurise({ d: "a\u2028b\u2029c" });
    expect(sortie).not.toContain("\u2028");
    expect(sortie).not.toContain("\u2029");
    expect(sortie).toContain("\\u2028");
  });

  it("reste du JSON valide et fidele a l'entree", () => {
    const original = { d: "</script>", n: 12_500_000, l: ["a<b", "c&d"] };
    expect(JSON.parse(jsonLdSecurise(original))).toEqual(original);
  });
});

describe("destination de redirection apres connexion", () => {
  it("accepte les chemins internes du back-office", () => {
    expect(destinationSure("/admin")).toBe("/admin");
    expect(destinationSure("/admin/motos")).toBe("/admin/motos");
    expect(destinationSure("/admin/import?onglet=photos")).toBe("/admin/import?onglet=photos");
  });

  it("refuse toute destination externe", () => {
    for (const hostile of [
      "https://evil.example",
      "http://evil.example/admin",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "/admin/../../evil",
      "/admin//evil.example",
      "/motos",
      "",
      null,
      undefined,
      42,
      { toString: () => "/admin" },
    ]) {
      expect(destinationSure(hostile)).toBe("/admin");
    }
  });
});

describe("determination de l'adresse client", () => {
  it("privilegie l'en-tete pose par la plateforme", () => {
    const h = new Headers({
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      "x-real-ip": "9.9.9.9",
    });
    expect(ipDepuisEntetes(h)).toBe("9.9.9.9");
  });

  it("ignore la premiere entree de X-Forwarded-For, qui est falsifiable", () => {
    // Un client peut ecrire ce qu'il veut en tete de chaine ; seule la
    // derniere entree est ecrite par le relais le plus proche.
    const h = new Headers({ "x-forwarded-for": "203.0.113.1, 198.51.100.9" });
    expect(ipDepuisEntetes(h)).toBe("198.51.100.9");
    expect(ipDepuisEntetes(h)).not.toBe("203.0.113.1");
  });

  it("retombe sur une valeur neutre sans en-tete", () => {
    expect(ipDepuisEntetes(new Headers())).toBe("0.0.0.0");
  });
});

describe("hachage des adresses IP", () => {
  it("ne laisse jamais l'adresse en clair", () => {
    process.env.IP_SALT = "un-sel-suffisamment-long-pour-etre-accepte";
    const h = hacherIp("41.188.12.3");
    expect(h).not.toContain("41.188");
    expect(h).toHaveLength(32);
  });

  it("change completement de valeur quand le sel change", () => {
    process.env.IP_SALT = "premier-sel-suffisamment-long-ici";
    const a = hacherIp("41.188.12.3");
    process.env.IP_SALT = "second-sel-suffisamment-long-ici";
    expect(hacherIp("41.188.12.3")).not.toBe(a);
  });
});

describe("limitation de debit", () => {
  beforeEach(() => viderLimiteur());

  it("laisse passer le quota puis bloque", () => {
    for (let i = 0; i < 5; i++) expect(limiterDebit("a", 5).autorise).toBe(true);
    expect(limiterDebit("a", 5).autorise).toBe(false);
  });

  it("borne le flot global meme si chaque requete change d'adresse", () => {
    let acceptees = 0;
    for (let i = 0; i < 200; i++) {
      const v = limiterDebitDouble(
        "test",
        `10.0.0.${i}`,
        { max: 5, fenetreMs: 60_000 },
        { max: 30, fenetreMs: 60_000 }
      );
      if (v.autorise) acceptees++;
    }
    expect(acceptees).toBe(30);
  });

  it("indique l'etage qui a bloque", () => {
    for (let i = 0; i < 5; i++) limiterDebitDouble("t2", "1.1.1.1", { max: 5, fenetreMs: 60_000 }, { max: 999, fenetreMs: 60_000 });
    const v = limiterDebitDouble("t2", "1.1.1.1", { max: 5, fenetreMs: 60_000 }, { max: 999, fenetreMs: 60_000 });
    expect(v.motif).toBe("ip");
  });

  it("borne sa propre table pour resister a une rotation d'adresses", () => {
    for (let i = 0; i < 40_000; i++) limiterDebit(`flood:${i}`, 5, 60_000);
    expect(tailleLimiteur()).toBeLessThanOrEqual(20_000);
  });
});

describe("configuration en production", () => {
  it("refuse de signer avec un secret de developpement", async () => {
    definirEnv("NODE_ENV", "production");
    delete process.env.AUTH_SECRET;
    const { secretSession } = await import("@/lib/config");
    expect(() => secretSession()).toThrow(/AUTH_SECRET/);
  });

  it("accepte un secret suffisamment long", async () => {
    definirEnv("NODE_ENV", "production");
    process.env.AUTH_SECRET = "a".repeat(64);
    const { secretSession } = await import("@/lib/config");
    expect(secretSession()).toHaveLength(64);
  });

  it("ne garde aucun compte par defaut en production", async () => {
    definirEnv("NODE_ENV", "production");
    delete process.env.ADMIN_ACCOUNTS;
    const { comptes, authentifier } = await import("@/lib/auth");
    expect(comptes()).toHaveLength(0);
    expect(authentifier("nihasy@moto-import.mg", "moto-import-2026")).toBeNull();
  });

  it("signale les variables bloquantes en production", async () => {
    definirEnv("NODE_ENV", "production");
    delete process.env.AUTH_SECRET;
    delete process.env.ADMIN_ACCOUNTS;
    const { diagnosticConfiguration } = await import("@/lib/config");
    const d = diagnosticConfiguration();
    expect(d.bloquants.join(" ")).toMatch(/AUTH_SECRET/);
    expect(d.bloquants.join(" ")).toMatch(/ADMIN_ACCOUNTS/);
  });
});
