import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { demandePatchSchema } from "@/lib/schemas";
import { sessionCourante } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await sessionCourante();
  if (!session) return Response.json({ erreur: "Non autorise" }, { status: 401 });

  const { id } = await params;
  const parse = demandePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parse.success) {
    const i = parse.error.issues[0];
    return Response.json({ erreur: i.message, champ: String(i.path[0] ?? "") }, { status: 400 });
  }
  try {
    const demande = await db().majDemande(id, parse.data);
    return Response.json({ ok: true, demande });
  } catch {
    return Response.json({ erreur: "Demande introuvable" }, { status: 404 });
  }
}
