import { createHash } from "node:crypto";
import { mentionCarteGrise } from "@/lib/immatriculation";
import type { MotoAvecMedias } from "@/lib/types";

/**
 * Version de l'image de partage (la carte qu'affichent Facebook et Messenger).
 *
 * Facebook garde une image en cache tant que son adresse ne change pas. Le
 * fichier `opengraph-image` de Next datait son adresse du code, pas des
 * données : après une hausse de prix, Messenger affichait l'ancien prix sur
 * l'image et le nouveau dans le titre. L'adresse porte donc une empreinte de
 * tout ce que l'image écrit : changer le prix, le statut ou la photo de
 * couverture donne une nouvelle adresse, que Facebook va chercher.
 */
export function versionApercu(moto: MotoAvecMedias): string {
  const couverture = moto.medias[0];
  const contenu = [
    moto.prix_ttc,
    moto.statut,
    moto.marque,
    moto.modele,
    moto.annee,
    moto.cylindree,
    moto.etat,
    moto.reference,
    mentionCarteGrise(moto),
    couverture?.cloudinary_id ?? "",
    couverture?.origine ?? "",
  ];
  return createHash("sha256").update(JSON.stringify(contenu)).digest("hex").slice(0, 12);
}

/** Chemin de l'image de partage d'une fiche, version comprise. */
export const cheminApercu = (moto: MotoAvecMedias) =>
  `/motos/${moto.slug}/apercu?v=${versionApercu(moto)}`;
