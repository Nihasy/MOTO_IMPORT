"use client";

import {
  FILIGRANE_LARGEUR,
  FILIGRANE_MARGE,
  FILIGRANE_OPACITE,
  FILIGRANE_SRC,
  CLOUD_NAME,
  filigraneALEnvoi,
} from "./cloudinary";
import type { Origine } from "./types";

export type FichierPret = {
  blob: Blob;
  nom: string;
  largeur: number;
  hauteur: number;
  blurhash: string;
};

const COTE_MAX = 2400;
const QUALITE = 0.82;

/**
 * Compression côté navigateur avant tout envoi (7.3, étape 5) :
 * plus grand côté 2400 px, qualité 82, WebP.
 *
 * `filigrane` incruste la marque dans les pixels du fichier envoyé. On ne le
 * demande que lorsque Cloudinary ne la posera pas à la livraison — voir
 * `filigraneALEnvoi`. C'est la seule protection qui survive à un
 * téléchargement : une surcouche CSS ne part pas avec le fichier.
 */
export async function compresser(
  fichier: File,
  opts: { filigrane?: boolean } = {}
): Promise<FichierPret> {
  const bitmap = await creerBitmap(fichier);
  const ratio = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
  const largeur = Math.round(bitmap.width * ratio);
  const hauteur = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible sur ce navigateur");
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
  if (opts.filigrane) await incrusterFiligrane(ctx, largeur, hauteur);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", QUALITE));
  if (!blob) throw new Error("Compression impossible");

  return {
    blob,
    nom: fichier.name.replace(/\.[^.]+$/, "") + ".webp",
    largeur,
    hauteur,
    blurhash: apercuMinuscule(ctx, canvas),
  };
}

/**
 * Pose la marque en bas à gauche, à la même emprise que la surcouche CSS et
 * que la couche Cloudinary. En cas d'échec — fichier absent, canevas souillé —
 * la photo part sans marque : mieux vaut une photo nue qu'un envoi perdu.
 */
async function incrusterFiligrane(
  ctx: CanvasRenderingContext2D,
  largeur: number,
  hauteur: number
): Promise<void> {
  try {
    const marque = new window.Image();
    await new Promise<void>((ok, ko) => {
      marque.onload = () => ok();
      marque.onerror = () => ko(new Error("Filigrane introuvable"));
      marque.src = FILIGRANE_SRC;
    });
    const l = Math.round(largeur * FILIGRANE_LARGEUR);
    const h = Math.round((marque.naturalHeight / marque.naturalWidth) * l);
    const marge = Math.round(largeur * FILIGRANE_MARGE);
    ctx.save();
    ctx.globalAlpha = FILIGRANE_OPACITE;
    ctx.drawImage(marque, marge, hauteur - h - marge, l, h);
    ctx.restore();
  } catch {
    /* Sans marque plutôt que sans photo. */
  }
}

async function creerBitmap(fichier: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(fichier);
    } catch {
      /* HEIC non décodable : on retombe sur <img> */
    }
  }
  const url = URL.createObjectURL(fichier);
  try {
    const img = new window.Image();
    await new Promise<void>((ok, ko) => {
      img.onload = () => ok();
      img.onerror = () => ko(new Error("Image illisible"));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Aperçu instantané : data URL 16 px, tenant lieu de blurhash. */
function apercuMinuscule(_ctx: CanvasRenderingContext2D, source: HTMLCanvasElement): string {
  try {
    const petit = document.createElement("canvas");
    petit.width = 16;
    petit.height = 12;
    const c = petit.getContext("2d");
    if (!c) return "";
    c.drawImage(source, 0, 0, 16, 12);
    return petit.toDataURL("image/webp", 0.5);
  } catch {
    return "";
  }
}

export type Televersement = { cloudinary_id: string; largeur: number; hauteur: number; blurhash: string };

/** Upload direct navigateur -> Cloudinary avec signature serveur. */
export async function televerser(pret: FichierPret, dossier: string): Promise<Televersement> {
  const rep = await fetch("/api/upload/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: dossier }),
  });
  if (!rep.ok) {
    const { erreur } = (await rep.json().catch(() => ({}))) as { erreur?: string };
    throw new Error(erreur ?? "Signature refusée");
  }
  const { signature, timestamp, api_key, cloud_name } = (await rep.json()) as {
    signature: string;
    timestamp: number;
    api_key: string;
    cloud_name: string;
  };

  const form = new FormData();
  form.append("file", pret.blob, pret.nom);
  form.append("api_key", api_key);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", dossier);

  const envoi = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!envoi.ok) throw new Error(`Cloudinary a refusé ${pret.nom}`);
  const json = (await envoi.json()) as { public_id: string; width: number; height: number };
  return {
    cloudinary_id: json.public_id,
    largeur: json.width,
    hauteur: json.height,
    blurhash: pret.blurhash,
  };
}

/**
 * Repli sans Cloudinary : la photo compressée est conservée en data URL.
 * Permet de faire tourner et de recetter tout le parcours sans compte externe.
 */
export async function versDataUrl(pret: FichierPret): Promise<Televersement> {
  const dataUrl = await new Promise<string>((ok, ko) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.onerror = () => ko(new Error("Lecture impossible"));
    fr.readAsDataURL(pret.blob);
  });
  return {
    cloudinary_id: dataUrl,
    largeur: pret.largeur,
    hauteur: pret.hauteur,
    blurhash: pret.blurhash,
  };
}

/**
 * Envoi d'une photo.
 *
 * Cloudinary configuré, la photo y part, ou l'envoi échoue : **aucun repli**.
 * L'ancien repli en data URL recopiait l'image, en base64, dans le HTML de
 * chaque page qui l'affiche — deux fois, avec les données de React. Deux
 * fiches repliées suffisaient à faire peser 2,8 Mo à la page du catalogue,
 * pour chaque visiteur : ce qui empêchait le site de tenir la charge. Un envoi
 * refusé (quota épuisé, coupure réseau) est désormais compté en échec à
 * l'écran et se relance, au lieu d'alourdir silencieusement le site.
 *
 * Sans Cloudinary — développement, démonstration — la data URL reste le seul
 * stockage possible ; la marque y est alors incrustée d'office
 * (`filigraneALEnvoi`), puisque personne ne la posera à la livraison.
 */
export async function envoyerPhoto(
  fichier: File,
  origine: Origine,
  dossier: string
): Promise<Televersement> {
  const pret = await compresser(fichier, { filigrane: filigraneALEnvoi() });
  return CLOUD_NAME ? televerser(pret, dossier) : versDataUrl(pret);
}

/** File d'envoi à trois requêtes simultanées (7.3, étape 6). */
export async function fileDEnvoi<T, R>(
  elements: T[],
  travail: (e: T, i: number) => Promise<R>,
  simultanes = 3,
  surAvancement?: (faits: number, total: number) => void
): Promise<PromiseSettledResult<R>[]> {
  const resultats: PromiseSettledResult<R>[] = new Array(elements.length);
  let curseur = 0;
  let faits = 0;

  const ouvrier = async () => {
    while (curseur < elements.length) {
      const i = curseur++;
      try {
        resultats[i] = { status: "fulfilled", value: await travail(elements[i], i) };
      } catch (raison) {
        resultats[i] = { status: "rejected", reason: raison };
      }
      surAvancement?.(++faits, elements.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(simultanes, elements.length) }, ouvrier));
  return resultats;
}
