import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sessionCourante } from "@/lib/auth";

export const runtime = "nodejs";

/** Annulation d'un lot : supprime exactement les medias inseres par ce lot. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionCourante();
  if (!session) return Response.json({ erreur: "Non autorise" }, { status: 401 });
  if (session.role !== "admin") {
    return Response.json({ erreur: "Reserve a l'administrateur" }, { status: 403 });
  }

  const { id } = await params;
  const supprimes = await db().annulerLot(id);
  revalidatePath("/motos");
  return Response.json({ ok: true, medias_supprimes: supprimes });
}
