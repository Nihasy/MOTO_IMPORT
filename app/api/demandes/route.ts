import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { demandeSchema } from "@/lib/schemas";
import {
  corpsJsonBorne,
  hacherIp,
  ipDepuisEntetes,
  limiterDebitDouble,
  tropDeRequetes,
} from "@/lib/securite";
import { sessionCourante } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CORPS = 16 * 1024;

/**
 * Enregistre une demande avant la redirection WhatsApp.
 *
 * Public, donc doublement borné : 5 requêtes/minute/adresse comme le prévoit
 * le chapitre 11, et 60/minute toutes adresses confondues — cet étage global
 * est ce qui tient si l'adresse source est falsifiée.
 */
export async function POST(req: NextRequest) {
  const ip = ipDepuisEntetes(req.headers);
  const verdict = limiterDebitDouble(
    "demandes",
    ip,
    { max: 5, fenetreMs: 60_000 },
    { max: 60, fenetreMs: 60_000 }
  );
  if (!verdict.autorise) return tropDeRequetes(verdict.resetDans);

  const corps = await corpsJsonBorne(req, MAX_CORPS);
  if (!corps.ok) return Response.json({ erreur: corps.erreur }, { status: corps.statut });

  const parse = demandeSchema.safeParse(corps.donnees);
  if (!parse.success) {
    const i = parse.error.issues[0];
    return Response.json({ erreur: i.message, champ: String(i.path[0] ?? "") }, { status: 400 });
  }

  try {
    const demande = await db().creerDemande({
      ...parse.data,
      moto_id: parse.data.moto_id ?? null,
      reference: parse.data.reference ?? null,
      nom: parse.data.nom ?? null,
      telephone: parse.data.telephone ?? null,
      budget_max: parse.data.budget_max ?? null,
      message: parse.data.message ?? null,
      notes: null,
      ip_hash: hacherIp(ip),
    });
    // Réponse volontairement minimale : aucune donnée interne ne sort d'ici.
    return Response.json({ ok: true, id: demande.id }, { status: 201 });
  } catch {
    return Response.json({ erreur: "Enregistrement impossible" }, { status: 500 });
  }
}

export async function GET() {
  const session = await sessionCourante();
  if (!session) return Response.json({ erreur: "Non autorisé" }, { status: 401 });
  return Response.json({ demandes: await db().listerDemandes() });
}
