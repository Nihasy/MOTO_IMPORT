import type { Categorie } from "@/lib/types";

/**
 * Pictogrammes de type du sélecteur de catalogue.
 *
 * Les fichiers de `public/types` sont des masques : la silhouette est portée
 * par le canal alpha, pas par la couleur. On les applique en `mask-image` sur
 * un aplat de `currentColor`, si bien que le pictogramme suit l'état de la
 * tuile — chrome au repos, champagne quand le type est actif — sans dupliquer
 * les fichiers. Un masque en niveaux de gris sans alpha serait lu comme
 * entièrement opaque : c'est bien l'alpha qui compte.
 *
 * Les sept masques partagent un canevas 153x90, contenu aligné sur la ligne de
 * sol : la rangée ne danse pas et les tailles relatives sont conservées — le
 * custom long et bas, le trail haut, les petites roues du scooter.
 *
 * Régénération depuis les sources : `scripts/detourage-types.py`.
 */
function Pictogramme({ cle }: { cle: string }) {
  const source = `url(/types/${cle}.png)`;
  return (
    <span
      aria-hidden
      className="pictogramme-type block h-9 w-[61px] bg-current"
      style={{
        maskImage: source,
        WebkitMaskImage: source,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

export const ICONE_CATEGORIE: Record<Categorie, React.ReactNode> = {
  routiere: <Pictogramme cle="routiere" />,
  sportive: <Pictogramme cle="sportive" />,
  roadster: <Pictogramme cle="roadster" />,
  trail: <Pictogramme cle="trail" />,
  custom: <Pictogramme cle="custom" />,
  motocross: <Pictogramme cle="motocross" />,
  scooter: <Pictogramme cle="scooter" />,
};

/**
 * « Toutes » ne prend pas de silhouette : une huitième moto générique se
 * confondrait avec le roadster. Quatre pavés, au trait pour ne pas peser plus
 * lourd que les motos qui l'entourent.
 */
export const IconeToutes = (
  <svg
    viewBox="0 0 153 90"
    fill="none"
    stroke="currentColor"
    strokeWidth="5"
    className="block h-9 w-[61px]"
    aria-hidden
  >
    <rect x="47" y="22" width="26" height="20" rx="4" />
    <rect x="81" y="22" width="26" height="20" rx="4" />
    <rect x="47" y="49" width="26" height="20" rx="4" />
    <rect x="81" y="49" width="26" height="20" rx="4" />
  </svg>
);
