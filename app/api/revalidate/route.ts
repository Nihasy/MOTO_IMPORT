import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sessionCourante } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  const session = await sessionCourante();
  const attendu = process.env.REVALIDATE_SECRET;
  const autorise = Boolean(session) || (attendu && secret === attendu);
  if (!autorise) return Response.json({ erreur: "Non autorise" }, { status: 401 });

  const { chemins } = (await req.json().catch(() => ({}))) as { chemins?: string[] };
  const cibles = chemins?.length ? chemins : ["/", "/motos"];
  for (const c of cibles) revalidatePath(c);
  return Response.json({ ok: true, revalides: cibles });
}
