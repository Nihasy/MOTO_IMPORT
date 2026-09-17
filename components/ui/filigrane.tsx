import Image from "next/image";
import clsx from "clsx";
import {
  FILIGRANE_LARGEUR,
  FILIGRANE_MARGE,
  FILIGRANE_OPACITE,
  FILIGRANE_RATIO,
  FILIGRANE_SRC,
} from "@/lib/cloudinary";

/**
 * Marque posée par-dessus une photo.
 *
 * Une capture d'écran enregistre ce qui est affiché : c'est le seul endroit où
 * l'on puisse encore marquer une image que Cloudinary ne transforme pas — les
 * photos servies en direct ou en data URL, c'est-à-dire tout le catalogue tant
 * qu'aucun compte Cloudinary n'est branché. Quand la marque est déjà dans les
 * pixels du fichier livré, cette surcouche s'efface : voir `filigraneIncruste`.
 *
 * `aria-hidden` : la marque est décorative, elle n'ajoute rien à l'`alt` de la
 * photo qu'elle recouvre.
 */
export function Filigrane({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx("pointer-events-none absolute inset-x-0 bottom-0 flex justify-start", className)}
      style={{ padding: `${FILIGRANE_MARGE * 100}%` }}
    >
      <Image
        src={FILIGRANE_SRC}
        alt=""
        width={1001}
        height={240}
        // La marque ne dépasse jamais 320 px de large : l'annoncer évite que
        // l'optimiseur ne serve une source de 128 px, floue dès qu'un écran
        // dense l'affiche.
        sizes="320px"
        className="h-auto"
        style={{
          width: `${(FILIGRANE_LARGEUR / (1 - 2 * FILIGRANE_MARGE)) * 100}%`,
          maxWidth: 320,
          minWidth: 96,
          aspectRatio: FILIGRANE_RATIO,
          opacity: FILIGRANE_OPACITE,
        }}
      />
    </span>
  );
}
