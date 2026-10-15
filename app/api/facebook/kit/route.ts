import { NextRequest } from "next/server";
import { sessionCourante } from "@/lib/auth";
import { albumSchema, texteKit } from "@/lib/facebook";
import { origineDe, rendreAlbum } from "@/lib/studio-facebook";
import { creerZip } from "@/lib/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Dix cartes, chacune avec sa photo à télécharger chez Cloudinary.
export const maxDuration = 60;

/**
 * Kit de l'album : les cartes numérotées dans l'ordre et un fichier texte avec
 * le post et chaque légende. C'est la voie manuelle — publier depuis le
 * téléphone, ou partager dans les groupes, où l'API ne publie plus depuis 2024.
 */
export async function POST(req: NextRequest) {
  if (!(await sessionCourante())) return Response.json({ erreur: "Non autorisé" }, { status: 401 });

  const parse = albumSchema.safeParse(await req.json().catch(() => null));
  if (!parse.success) {
    return Response.json({ erreur: parse.error.issues[0]?.message ?? "Album invalide" }, { status: 400 });
  }

  try {
    const cartes = await rendreAlbum(parse.data, origineDe(req.headers));
    const zip = creerZip([
      ...cartes.map((c) => ({ nom: c.nom, contenu: new Uint8Array(c.png) })),
      { nom: "legendes.txt", contenu: texteKit(parse.data) },
    ]);
    return new Response(new Blob([zip as Uint8Array<ArrayBuffer>]), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="album-facebook.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ erreur: (e as Error).message }, { status: 422 });
  }
}
