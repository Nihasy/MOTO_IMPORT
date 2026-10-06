import { NextRequest } from "next/server";
import { cataloguePublic } from "@/lib/catalogue-public";
import { SUGGESTIONS_VIDES, suggerer } from "@/lib/suggestions";
import { ipDepuisEntetes, limiterDebitDouble, tropDeRequetes } from "@/lib/securite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Au-delà, ce n'est plus une recherche : la requête est tronquée. */
const LONGUEUR_MAX = 80;

/**
 * Suggestions de la boîte de recherche, demandées pendant la frappe.
 *
 * Elles se calculent sur l'instantané du catalogue (`cataloguePublic`), jamais
 * en base : une frappe ne coûte pas un octet d'egress Supabase. Publique donc
 * bornée, plus largement que les tranches puisqu'une recherche envoie une
 * requête toutes les quelques lettres.
 */
export async function GET(req: NextRequest) {
  const verdict = limiterDebitDouble(
    "recherche",
    ipDepuisEntetes(req.headers),
    { max: 120, fenetreMs: 60_000 },
    { max: 3000, fenetreMs: 60_000 }
  );
  if (!verdict.autorise) return tropDeRequetes(verdict.resetDans);

  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, LONGUEUR_MAX);
  if (!q.trim()) return Response.json(SUGGESTIONS_VIDES);

  try {
    return Response.json(suggerer(await cataloguePublic(), q), {
      // Même réponse pour tout le monde : le CDN la garde une minute, si bien
      // que les recherches courantes (« honda », « cross ») ne réveillent pas
      // la fonction à chaque visiteur.
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (e) {
    // Catalogue indisponible : la boîte n'affiche rien, l'envoi du formulaire
    // reste possible. Jamais mis en cache.
    console.error("[recherche] suggestions indisponibles :", (e as Error).message);
    return Response.json(SUGGESTIONS_VIDES, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
