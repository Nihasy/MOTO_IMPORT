"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sessionCourante } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  albumSchema, commentaireVente, erreurProgrammation, ventesASignaler, type Album,
} from "@/lib/facebook";
import { commenter, facebookConfigure, lienPost, publierAlbum } from "@/lib/facebook-graph";
import { lignesStudio, origineDe, rendreAlbum } from "@/lib/studio-facebook";

export type ResultatFb = { ok: true; message: string; lien?: string | null } | { ok: false; erreur: string };

async function exigerSession() {
  const s = await sessionCourante();
  if (!s) redirect("/connexion");
  return s;
}

const echec = (e: unknown): ResultatFb => ({ ok: false, erreur: (e as Error).message || "Échec inattendu." });

/**
 * Publie l'album sur la page, ou le programme. C'est le seul geste du Studio qui
 * parle au public : il n'est atteint qu'après la confirmation explicite de
 * l'écran, et il refait ici toutes les vérifications — une action serveur est
 * un point d'entrée HTTP comme un autre.
 */
export async function publierSurFacebook(album: Album, programmeLe: string | null): Promise<ResultatFb> {
  const session = await exigerSession();
  if (!facebookConfigure()) {
    return { ok: false, erreur: "Publication directe non configurée : téléchargez le kit et publiez à la main." };
  }
  const parse = albumSchema.safeParse(album);
  if (!parse.success) return { ok: false, erreur: parse.error.issues[0]?.message ?? "Album invalide." };

  const quand = programmeLe ? new Date(programmeLe) : null;
  if (quand) {
    const refus = erreurProgrammation(quand);
    if (refus) return { ok: false, erreur: refus };
  }

  try {
    const cartes = await rendreAlbum(parse.data, origineDe(await headers()));
    const { postId, lien } = await publierAlbum({
      message: parse.data.message,
      photos: cartes,
      programmeLe: quand,
    });
    await db()
      .creerPublicationFb({
        mode: quand ? "programme" : "direct",
        post_id: postId,
        lien_post: lien,
        programme_pour: quand ? quand.toISOString() : null,
        titre: parse.data.titre,
        message: parse.data.message,
        refs: parse.data.motos.map((m) => m.ref),
        ventes_signalees: [],
        auteur: session.email,
      })
      .catch((e) => {
        // Le post est parti : un journal en panne (migration 0013 absente) ne
        // doit pas faire croire à un échec et pousser à republier.
        console.error("[studio facebook] journal :", (e as Error).message);
      });
    revalidatePath("/admin/facebook");
    return {
      ok: true,
      message: quand
        ? `Album programmé pour le ${quand.toLocaleString("fr-FR", { timeZone: "Indian/Antananarivo" })}.`
        : "Album publié sur la page.",
      lien,
    };
  } catch (e) {
    return echec(e);
  }
}

/**
 * Consigne un album publié à la main depuis le kit. Sans cela, ses motos
 * resteraient « jamais publiées » et reviendraient dans le prochain album.
 */
export async function consignerPublicationManuelle(album: Album, lien: string): Promise<ResultatFb> {
  const session = await exigerSession();
  const parse = albumSchema.safeParse(album);
  if (!parse.success) return { ok: false, erreur: parse.error.issues[0]?.message ?? "Album invalide." };
  const lienPropre = lien.trim();
  if (lienPropre && !/^https:\/\/(www\.|m\.|web\.)?facebook\.com\//.test(lienPropre)) {
    return { ok: false, erreur: "Le lien doit être celui du post sur facebook.com." };
  }
  try {
    await db().creerPublicationFb({
      mode: "manuel",
      post_id: null,
      lien_post: lienPropre || null,
      programme_pour: null,
      titre: parse.data.titre,
      message: parse.data.message,
      refs: parse.data.motos.map((m) => m.ref),
      ventes_signalees: [],
      auteur: session.email,
    });
    revalidatePath("/admin/facebook");
    return { ok: true, message: "Publication consignée : ces motos ne sont plus « jamais publiées »." };
  } catch (e) {
    return echec(e);
  }
}

/**
 * Commente « VENDUE » sous un post pour les motos vendues depuis. Toujours
 * déclenché à la main, depuis le journal : un commentaire public part sous le
 * nom de la page, il passe donc par le même feu vert qu'une publication.
 */
export async function signalerVentes(publicationId: string): Promise<ResultatFb> {
  await exigerSession();
  if (!facebookConfigure()) return { ok: false, erreur: "Publication directe non configurée." };
  try {
    const [publications, motos] = await Promise.all([db().listerPublicationsFb(), lignesStudio()]);
    const vendues = new Set(motos.filter((m) => m.statut === "vendu").map((m) => m.reference));
    const cible = ventesASignaler(publications, vendues).find((v) => v.publication.id === publicationId);
    if (!cible) return { ok: false, erreur: "Plus rien à signaler sur ce post." };

    const parRef = new Map(motos.map((m) => [m.reference, m]));
    await commenter(cible.publication.post_id!, commentaireVente(cible.refs.map((r) => parRef.get(r)!)));
    await db().majPublicationFb(publicationId, {
      ventes_signalees: [...cible.publication.ventes_signalees, ...cible.refs],
    });
    revalidatePath("/admin/facebook");
    return {
      ok: true,
      message: `Commentaire publié : ${cible.refs.join(", ")}.`,
      lien: lienPost(cible.publication.post_id!),
    };
  } catch (e) {
    return echec(e);
  }
}
