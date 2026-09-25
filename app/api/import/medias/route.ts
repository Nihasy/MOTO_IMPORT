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
  // Photos dont la place était déjà occupée : ni réussite ni échec. Leur
  // fichier Cloudinary n'est plus référencé, `scripts/menage-cloudinary.mjs`
  // le reprendra.
  const deja_presents: string[] = [];
  const slugs = new Set<string>();

  // Une requête par moto et non par photo : photo par photo, 131 photos
  // frôlaient les 60 s de `maxDuration`, et une fonction coupée en route
  // laissait un lot à moitié écrit, affiché « 0 réussi ».
  const parMoto = new Map<string, typeof medias>();
  for (const m of medias) parMoto.set(m.moto_id, [...(parMoto.get(m.moto_id) ?? []), m]);

  for (const [motoId, siens] of parMoto) {
    const moto = await pilote.motoParId(motoId).catch(() => null);
    if (!moto) {
      for (const m of siens) echoues.push({ cloudinary_id: m.cloudinary_id, motif: "Moto introuvable pour ce média" });
      continue;
    }
    const lignes = siens.map(
      (m) =>
        ({
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
        }) as Omit<Media, "id" | "created_at">
    );
    // Au-delà de 900 : fichiers assignés à la main, sans place à eux, qui
    // doivent s'ajouter à la suite. En deçà : la place vient du nom du fichier.
    const nommees = lignes.filter((l) => l.ordre < 900);
    const manuelles = lignes.filter((l) => l.ordre >= 900);
    try {
      const inserees = [
        ...(nommees.length ? await pilote.ajouterMedias(nommees, lot.id, { siOrdrePris: "ignorer" }) : []),
        ...(manuelles.length ? await pilote.ajouterMedias(manuelles, lot.id) : []),
      ];
      const ids = new Set(inserees.map((x) => x.cloudinary_id));
      for (const l of lignes) (ids.has(l.cloudinary_id) ? reussis : deja_presents).push(l.cloudinary_id);
      if (ids.size) slugs.add(moto.slug);
    } catch (e) {
      for (const l of lignes) echoues.push({ cloudinary_id: l.cloudinary_id, motif: (e as Error).message });
    }
  }

  const lotFinal = await pilote.majLot(lot.id, {
    reussis: reussis.length,
    echoues: echoues.length,
    rapport: { reussis, echoues, deja_presents },
  });
  for (const slug of slugs) revalidatePath(`/motos/${slug}`);
  revalidatePath("/motos");

  return Response.json({
    ok: echoues.length === 0,
    lot_id: lot.id,
    total: medias.length,
    reussis: reussis.length,
    echoues: echoues.length,
    deja_presents: deja_presents.length,
    details: echoues,
    lot: lotFinal,
  });
}
