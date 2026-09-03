import Image from "next/image";
import clsx from "clsx";

/**
 * Médaillon de marque.
 *
 * Le fichier source est un JPEG carré sur fond sombre texturé : posé tel quel
 * sur le fond du site, il laisserait voir ses quatre coins. Il est donc masqué
 * en cercle, et légèrement agrandi pour que l'anneau doré affleure le bord au
 * lieu de flotter au milieu d'une marge noire.
 *
 * `alt` est vide à dessein : le nom de la marque est écrit en toutes lettres
 * juste à côté, et le lien qui l'entoure porte déjà son intitulé. Le répéter
 * ferait entendre « MOTO IMPORT » trois fois à un lecteur d'écran.
 */
export function Logo({ taille = 34, className }: { taille?: number; className?: string }) {
  return (
    <span
      className={clsx(
        "relative block shrink-0 overflow-hidden rounded-full ring-1 ring-gold/30",
        className
      )}
      style={{ width: taille, height: taille }}
    >
      <Image
        src="/logo.jpeg"
        alt=""
        fill
        sizes={`${taille}px`}
        className="scale-[1.06] object-cover"
        priority
      />
    </span>
  );
}

/**
 * Verrou de marque : MOTO · médaillon · IMPORT.
 *
 * Les couleurs suivent celles du logo — « MOTO » en chrome, « IMPORT » en or —
 * et non l'inverse comme le faisaient les trois en-têtes avant lui.
 */
export function Marque({
  taille = 34,
  texte = 19,
  className,
}: {
  taille?: number;
  texte?: number;
  className?: string;
}) {
  const mot = "font-extrabold uppercase leading-none tracking-[0.08em]";
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <span className={clsx(mot, "text-chrome")} style={{ fontSize: texte }}>
        Moto
      </span>
      <Logo taille={taille} />
      <span className={clsx(mot, "text-gold-light")} style={{ fontSize: texte }}>
        Import
      </span>
    </span>
  );
}
