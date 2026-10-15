import { NextRequest } from "next/server";
import { sessionCourante } from "@/lib/auth";
import { carteCouverture, carteMoto } from "@/lib/carte-facebook";
import { motosDeLAlbum, origineDe } from "@/lib/studio-facebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aperçu d'une carte du Studio Facebook.
 *   ?ref=MI-123                      → carte d'une moto
 *   ?couverture=1&refs=MI-1,MI-2&titre=… → couverture de l'album
 *
 * Réservé au back-office : la carte montre un prix et une moto que le Studio
 * vérifie être en vente, mais rien ne justifie d'ouvrir au public un moteur de
 * rendu qui coûte une fonction à chaque appel.
 */
export async function GET(req: NextRequest) {
  if (!(await sessionCourante())) return new Response("Non autorisé", { status: 401 });

  const p = req.nextUrl.searchParams;
  const origine = origineDe(req.headers);
  try {
    if (p.get("couverture")) {
      const refs = (p.get("refs") ?? "").split(",").filter(Boolean).slice(0, 10);
      const motos = await motosDeLAlbum(refs);
      return avecEntetes(carteCouverture(p.get("titre") || "Motos du catalogue", motos, origine));
    }
    const [moto] = await motosDeLAlbum([p.get("ref") ?? ""]);
    return avecEntetes(carteMoto(moto, origine));
  } catch (e) {
    return new Response((e as Error).message, { status: 404 });
  }
}

/**
 * Cache privé et court : le navigateur garde l'aperçu le temps de composer un
 * album, sans qu'aucun cache partagé ne le conserve. Un prix change, et la carte
 * suit à la réouverture suivante.
 */
function avecEntetes(image: Response): Response {
  const h = new Headers(image.headers);
  h.set("Cache-Control", "private, max-age=300");
  return new Response(image.body, { status: image.status, headers: h });
}
