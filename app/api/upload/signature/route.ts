import { NextRequest } from "next/server";
import { cloudinaryConfigure, signerUpload } from "@/lib/cloudinary-serveur";
import { sessionCourante } from "@/lib/auth";

export const runtime = "nodejs";

/** Signature d'upload direct navigateur -> Cloudinary. Authentifie uniquement. */
export async function POST(req: NextRequest) {
  const session = await sessionCourante();
  if (!session) return Response.json({ erreur: "Non autorise" }, { status: 401 });
  if (!cloudinaryConfigure()) {
    return Response.json(
      { erreur: "Cloudinary non configure : renseignez CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET" },
      { status: 503 }
    );
  }

  const corps = (await req.json().catch(() => ({}))) as { folder?: string; public_id?: string };
  const params: Record<string, string> = { folder: corps.folder ?? "moto-import" };
  if (corps.public_id) params.public_id = corps.public_id;

  return Response.json(signerUpload(params));
}
