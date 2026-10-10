import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { FiltresCatalogue } from "@/lib/db/types";
import { appliquerFiltres, similaires, trierCatalogue } from "@/lib/db/filtres";
import { ETIQUETTE_CATALOGUE } from "@/lib/db/etiquettes";
import type { Media, MotoAvecMedias } from "@/lib/types";

/**
 * Catalogue public, lu en base une fois par jour au plus.
 *
 * Chaque page publique relisait la base à chaque visite : le catalogue, sa
 * pagination, et surtout chaque fiche, qui rechargeait toutes les motos et
 * toutes les photos pour n'en retenir que trois « similaires ». À 1,45 Mo la
 * lecture, les robots d'indexation ont suffi à sortir 18 Go de Supabase en
 * quinze jours (quota gratuit : 5 Go par mois), au point d'ouvrir une période
 * de grâce avant bridage le 31/10/2026.
 *
 * Tout passe désormais par cet instantané. Il est vidé à chaque écriture qui
 * touche une moto ou une photo (`lib/db/index.ts`), et sinon au bout d'un jour.
 *
 * Un jour et non une heure : le 10/10/2026, Vercel a coupé le site
 * (`DEPLOYMENT_DISABLED`, dépassement des écritures de cache du forfait
 * gratuit). Toutes les heures, cet instantané de plusieurs Mo et chaque fiche
 * visitée par un robot (160 Ko de HTML) se réécrivaient, même quand rien
 * n'avait changé. Les écritures du back-office vident le cache sur-le-champ ;
 * seuls les scripts qui écrivent en base sans passer par lui doivent le vider
 * eux-mêmes (`/api/revalidate`, ou `vercel cache invalidate --tag catalogue`).
 * Les pages qui lisent ce catalogue reprennent le même délai, et
 * `tests/quota-cache.test.ts` refuse qu'on le raccourcisse.
 */
const UN_JOUR = 86_400;

/**
 * Motos par lot de photos. Le cache de Next refuse toute entrée de plus de
 * 2 Mo, et le fait en silence : la lecture retomberait alors en base à chaque
 * visite, sans rien signaler. Une photo pèse 1 Ko environ (son aperçu flou est
 * une image encodée), soit moins de 500 Ko par lot de quarante motos.
 */
const MOTOS_PAR_LOT = 40;

const lireFiches = unstable_cache(() => db().listerFichesPubliques(), ["catalogue-fiches"], {
  tags: [ETIQUETTE_CATALOGUE],
  revalidate: UN_JOUR,
});

const lireMedias = unstable_cache((ids: string[]) => db().mediasDeMotos(ids), ["catalogue-medias"], {
  tags: [ETIQUETTE_CATALOGUE],
  revalidate: UN_JOUR,
});

/** Tout le catalogue public, photos comprises, dans l'ordre par défaut. */
const instantane = cache(async (): Promise<MotoAvecMedias[]> => {
  const fiches = await lireFiches();
  // Lots découpés sur les identifiants triés : tant qu'aucune fiche n'entre ni
  // ne sort, chaque lot garde la même clé de cache d'un rendu à l'autre.
  const ids = fiches.map((m) => m.id).sort();
  const lots: string[][] = [];
  for (let i = 0; i < ids.length; i += MOTOS_PAR_LOT) lots.push(ids.slice(i, i + MOTOS_PAR_LOT));
  const medias: Record<string, Media[]> = Object.assign({}, ...(await Promise.all(lots.map((l) => lireMedias(l)))));
  return fiches.map((m) => ({ ...m, medias: medias[m.id] ?? [] }));
});

/** Catalogue public filtré et trié, comme `listerMotosPubliques`. */
export async function cataloguePublic(f: FiltresCatalogue = {}): Promise<MotoAvecMedias[]> {
  return trierCatalogue(appliquerFiltres(await instantane(), f));
}

/** Fiche publique d'après son slug, ou `null`. */
export async function motoPublique(slug: string): Promise<MotoAvecMedias | null> {
  return (await instantane()).find((m) => m.slug === slug) ?? null;
}

/** Motos proches d'une fiche, pour le bloc « similaires ». */
export async function motosProches(slug: string, n: number): Promise<MotoAvecMedias[]> {
  const toutes = await instantane();
  const ref = toutes.find((m) => m.slug === slug);
  return ref ? similaires(toutes, ref, n) : [];
}

/** Slugs en ligne, pour le plan du site et la prégénération des fiches. */
export async function slugsEnLigne(): Promise<{ slug: string; updated_at: string }[]> {
  return (await instantane()).map(({ slug, updated_at }) => ({ slug, updated_at }));
}
