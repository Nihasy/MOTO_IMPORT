import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { importMediasSchema } from "@/lib/schemas";
import { sessionCourante } from "@/lib/auth";
import { corpsJsonBorne } from "@/lib/securite";

// 300 fichiers au plus par lot (7.3), images comprises en repli data URL.
const MAX_CORPS = 64 * 1024 * 1024;
const MAX_MEDIAS = 300;
import type { Media } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Enregistrement d'un lot de médias déjà téléversés vers Cloudinary. */
export async function POST(req: NextRequest) {
  const session = await sessionCourante();
  if (!session) return Response.json({ erreur: "Non autorisé" }, { status: 401 });

  const lu = await corpsJsonBorne(req, MAX_CORPS);
  if (!lu.ok) return Response.json({ erreur: lu.erreur }, { status: lu.statut });

  const parse = importMediasSchema.safeParse(lu.donnees);
  if (!parse.success) {
    const i = parse.error.issues[0];
    return Response.json({ erreur: i.message, champ: String(i.path.join(".")) }, { status: 400 });
  }

  const { medias, fichier_nom } = parse.data;
  if (medias.length > MAX_MEDIAS) {
    return Response.json(
      { erreur: `Lot refuse : ${medias.length} medias, maximum ${MAX_MEDIAS}.`, champ: "medias" },
      { status: 413 }
    );
  }

  const pilote = db();

  // Le lot est créé d'abord : chaque média porte son `lot_id`, ce qui rend
  // l'annulation exacte (recette 16.1).
  const lot = await pilote.creerLot({
    type: "medias_masse",
    fichier_nom: fichier_nom ?? null,
    total: medias.length,
    reussis: 0,
    echoues: 0,
    rapport: null,
    auteur_id: null,
  });

  const reussis: string[] = [];
  const echoues: { cloudinary_id: string; motif: string }[] = [];
  const slugs = new Set<string>();

  for (const m of medias) {
    try {
      const moto = await pilote.motoParId(m.moto_id);
      if (!moto) throw new Error("Moto introuvable pour ce média");
      await pilote.ajouterMedias(
        [
          {
            moto_id: m.moto_id,
            type: m.type,
            origine: m.origine,
            vue: m.vue,
            cloudinary_id: m.cloudinary_id,
            largeur: m.largeur,
            hauteur: m.hauteur,
            blurhash: m.blurhash ?? null,
            ordre: m.ordre,
            legende: m.legende ?? null,
            alt: m.alt,
            date_prise: m.date_prise ?? null,
          } as Omit<Media, "id" | "created_at">,
        ],
        lot.id
      );
      reussis.push(m.cloudinary_id);
      slugs.add(moto.slug);
    } catch (e) {
      echoues.push({ cloudinary_id: m.cloudinary_id, motif: (e as Error).message });
    }
  }

  const lotFinal = await pilote.majLot(lot.id, {
    reussis: reussis.length,
    echoues: echoues.length,
    rapport: { reussis, echoues },
  });
  for (const slug of slugs) revalidatePath(`/motos/${slug}`);
  revalidatePath("/motos");

  return Response.json({
    ok: echoues.length === 0,
    lot_id: lot.id,
    total: medias.length,
    reussis: reussis.length,
    echoues: echoues.length,
    details: echoues,
    lot: lotFinal,
  });
}
