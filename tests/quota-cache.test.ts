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

/**
 * La mesure d'audience Vercel facture chaque événement. Le 30/09/2026, les
 * événements fréquents (une photo balayée, une fiche vue) avaient mis l'ancien
 * compte en pause. Seuls des événements rares, qui marquent une intention
 * d'achat, ont le droit de partir vers Vercel.
 */
describe("événements envoyés à la mesure d'audience Vercel", () => {
  const source = lire("lib/analytics.ts");
  const liste = source.match(/VERS_VERCEL[^=]*= new Set\(\[([^\]]*)\]\)/);

  it("la liste des événements envoyés à Vercel est explicite", () => {
    expect(liste, "VERS_VERCEL attendu dans lib/analytics.ts").not.toBeNull();
  });

  it.each(["galerie_balayee", "vue_fiche", "filtre_applique", "recherche", "plein_ecran_ouvert"])(
    "%s, trop fréquent, ne part pas vers Vercel",
    (evenement) => {
      expect(liste![1]).not.toContain(`"${evenement}"`);
    }
  );

  it("track() n'est appelé que derrière cette liste", () => {
    // `ttq?.track(` est le pixel TikTok : seul l'appel nu compte.
    expect(source.match(/(?<![.\w])track\(/g)).toHaveLength(1);
    expect(source).toMatch(/if \(VERS_VERCEL\.has\(evenement\)\) track\(/);
  });
});
