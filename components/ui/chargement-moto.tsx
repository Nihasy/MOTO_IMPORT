import clsx from "clsx";

/**
 * Indicateur d'attente du site : une moto lancée, doublée par trois lignes de
 * vitesse.
 *
 * La silhouette est le masque `public/types/sportive.png` déjà employé par le
 * sélecteur de types (voir `components/catalogue/icones-types.tsx`) : le
 * dessin est porté par le canal alpha, appliqué en `mask-image` sur un aplat
 * de `currentColor`. Aucun fichier supplémentaire à servir, et la couleur suit
 * le contexte.
 *
 * La moto de ce masque roule vers la gauche : les lignes filent donc vers la
 * droite, dans son dos, et passent DERRIÈRE elle — la silhouette est opaque et
 * les masque au passage, ce qui donne le décor qui défile plutôt que trois
 * traits posés à côté.
 *
 * Tout est dessiné dans un cadre fixe de 208x92, puis mis à l'échelle d'un
 * bloc : une seule série de mesures à tenir pour les deux tailles.
 */

const CADRE = { largeur: 208, hauteur: 92 };

/** Position, longueur et décalage de départ des trois lignes de vitesse. */
const LIGNES = [
  { haut: 20, largeur: 34, retard: "0ms", couleur: "bg-chrome/45" },
  { haut: 42, largeur: 54, retard: "180ms", couleur: "bg-gold/80" },
  { haut: 64, largeur: 26, retard: "360ms", couleur: "bg-chrome/35" },
];

const MASQUE = "url(/types/sportive.png)";

export function ChargementMoto({
  texte = "Chargement",
  taille = "page",
  className,
}: {
  /** Annoncé aux lecteurs d'écran, et affiché sous la moto en taille page. */
  texte?: string;
  taille?: "page" | "compact";
  className?: string;
}) {
  const echelle = taille === "compact" ? 0.62 : 1;

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx("flex flex-col items-center justify-center gap-3 text-chrome", className)}
    >
      <div
        className="relative"
        style={{ width: CADRE.largeur * echelle, height: CADRE.hauteur * echelle }}
      >
        <div
          aria-hidden
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: CADRE.largeur, height: CADRE.hauteur, transform: `scale(${echelle})` }}
        >
          {LIGNES.map((l) => (
            <span
              key={l.haut}
              className={clsx("absolute left-0 h-[3px] rounded-full animate-filante", l.couleur)}
              style={{ top: l.haut, width: l.largeur, animationDelay: l.retard }}
            />
          ))}
          <span
            className="absolute bottom-0 left-[38px] block w-[132px] animate-soubresaut bg-current"
            style={{
              height: 78,
              maskImage: MASQUE,
              WebkitMaskImage: MASQUE,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "bottom center",
              WebkitMaskPosition: "bottom center",
            }}
          />
        </div>
      </div>
      {taille === "page" ? (
        <p className="text-meta text-dim">{texte}</p>
      ) : (
        <span className="sr-only">{texte}</span>
      )}
    </div>
  );
}

/**
 * Attente posée au milieu de l'écran, à la façon d'une application mobile :
 * la moto reste au centre du regard quelle que soit la hauteur de la page, et
 * le fond passe sous un voile flouté.
 *
 * Le flou porte sur ce qui est peint derrière — plaques d'attente, barre de
 * navigation, page précédente : le contenu reste deviné sans être lisible, ce
 * qui dit « ça arrive » plutôt que « il n'y a rien ». L'aplat semi-opaque par
 * dessus garantit le contraste du libellé, le flou seul ne suffirait pas sur
 * une photo claire.
 *
 * `z-[55]` : au-dessus de la barre de navigation et des feuilles (z-40, z-50),
 * sous la galerie plein écran (z-[60]) qui porte sa propre attente.
 */
export function VoileChargement({ texte }: { texte?: string }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-bg/70 px-4 backdrop-blur-md">
      <ChargementMoto texte={texte} />
    </div>
  );
}
