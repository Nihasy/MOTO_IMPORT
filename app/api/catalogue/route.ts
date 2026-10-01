import { NextRequest } from "next/server";
import { cataloguePublic } from "@/lib/catalogue-public";
import { CARTES_PAR_TRANCHE, selectionCatalogue, trancheCatalogue } from "@/lib/catalogue";
import { ipDepuisEntetes, limiterDebitDouble, tropDeRequetes } from "@/lib/securite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tranches suivantes du catalogue, demandees au defilement. Memes parametres
 * que l'URL de `/motos`, plus `depuis` : l'index de la premiere carte voulue.
 *
 * Public, donc borne : parcourir tout le catalogue ne coute que quelques
 * appels, soixante par minute laissent de la marge a un acheteur qui filtre
 * et refiltre. L'etage global tient si l'adresse source est falsifiee.
 */
export async function GET(req: NextRequest) {
  const verdict = limiterDebitDouble(
    "catalogue",
    ipDepuisEntetes(req.headers),
    { max: 60, fenetreMs: 60_000 },
    { max: 1200, fenetreMs: 60_000 }
  );
  if (!verdict.autorise) return tropDeRequetes(verdict.resetDans);

  const p = req.nextUrl.searchParams;
  const depuis = Number(p.get("depuis") ?? CARTES_PAR_TRANCHE);
  if (!Number.isInteger(depuis) || depuis < 0) {
    return Response.json({ erreur: "Paramètre « depuis » invalide." }, { status: 400 });
  }

  const selection = selectionCatalogue(await cataloguePublic(), (cle) => p.get(cle) ?? undefined);
  return Response.json({ motos: trancheCatalogue(selection, depuis), total: selection.length });
}
