import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ipDepuisEntetes, limiterDebit } from "@/lib/securite";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = ipDepuisEntetes(req.headers);
  const { autorise } = limiterDebit(`vue:${ip}:${id}`, 1, 30 * 60_000);
  if (autorise) {
    try {
      await db().incrementerVues(id);
    } catch {
      /* le compteur de vues ne doit jamais faire echouer la page */
    }
  }
  return new Response(null, { status: 204 });
}
