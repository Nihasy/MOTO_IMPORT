import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le 10/10/2026, Vercel a coupé le site : le cache du catalogue et les fiches se
 * réécrivaient toutes les heures, et les écritures de cache ont dépassé le
 * forfait. Les écritures du back-office vident le cache sur-le-champ ; le délai
 * ne sert qu'à rattraper les scripts. Ce test refuse qu'on le raccourcisse sous
 * un jour sans relire `lib/catalogue-public.ts`.
 */
const UN_JOUR = 86_400;
const lire = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("délais de cache du catalogue", () => {
  it.each(["app/(public)/page.tsx", "app/(public)/motos/[slug]/page.tsx", "app/sitemap.ts"])(
    "%s se régénère au plus une fois par jour",
    (f) => {
      const m = lire(f).match(/export const revalidate = ([\d_]+);/);
      expect(m, "revalidate littéral attendu").not.toBeNull();
      expect(Number(m![1].replace(/_/g, ""))).toBeGreaterThanOrEqual(UN_JOUR);
    }
  );

  it("les deux lectures en cache du catalogue durent au moins un jour", () => {
    const source = lire("lib/catalogue-public.ts");
    const duree = Number(source.match(/const UN_JOUR = ([\d_]+);/)![1].replace(/_/g, ""));
    expect(duree).toBeGreaterThanOrEqual(UN_JOUR);
    expect(source.match(/revalidate: UN_JOUR/g)).toHaveLength(2);
    expect(source).not.toMatch(/revalidate: \d/);
  });

  it("la route de revalidation vide aussi le cache du catalogue", () => {
    expect(lire("app/api/revalidate/route.ts")).toMatch(/revalidateTag\(ETIQUETTE_CATALOGUE\)/);
  });
});
