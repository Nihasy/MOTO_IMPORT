import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { statutPatchSchema } from "@/lib/schemas";
import { messageVerrou, verrouPublication } from "@/lib/publication";
import { sessionCourante } from "@/lib/auth";

export const runtime = "nodejs";

/** Bascule de statut : l'action la plus frequente de l'exploitation (10.2). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionCourante();
  if (!session) return Response.json({ erreur: "Non autorise" }, { status: 401 });

  const { id } = await params;
  const parse = statutPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parse.success) {
    return Response.json({ erreur: "Statut invalide", champ: "statut" }, { status: 400 });
  }

  // Verrou de publication (7.1, 10.3). Rejoué ici et pas seulement dans
  // l'action serveur : cette route est atteignable directement, et une règle
  // qui ne vit que dans l'interface n'est pas une règle.
  const avant = await db().motoParId(id);
  if (!avant) return Response.json({ erreur: "Moto introuvable" }, { status: 404 });

  const verrou = verrouPublication(avant, await db().mediasDeMoto(id), parse.data.statut);
  if (!verrou.autorise) {
    return Response.json(
      { erreur: messageVerrou(verrou.bloquants), champ: "statut", bloquants: verrou.bloquants },
      { status: 422 }
    );
  }

  try {
    const moto = await db().majStatut(id, parse.data.statut);
    revalidatePath("/motos");
    revalidatePath(`/motos/${moto.slug}`);
    revalidatePath("/");
    // Les écrans d'administration affichent eux aussi le statut : sans ces
    // deux lignes, la liste et la fiche restent sur l'état précédent.
    revalidatePath("/admin/motos");
    revalidatePath(`/admin/motos/${id}`);
    return Response.json({
      ok: true,
      moto: { id: moto.id, statut: moto.statut, date_vente: moto.date_vente, updated_at: moto.updated_at },
    });
  } catch {
    return Response.json({ erreur: "Moto introuvable" }, { status: 404 });
  }
}
