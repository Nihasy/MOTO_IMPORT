import Link from "next/link";
import clsx from "clsx";

/**
 * Primitives d'écran du back-office.
 *
 * Chaque page se composait jusqu'ici son propre en-tête : titres de tailles
 * différentes, actions tantôt à gauche tantôt à droite, sous-titres parfois
 * absents. Une même grammaire d'un écran à l'autre, c'est ce qui permet à une
 * personne qui n'ouvre l'outil qu'une fois par semaine de le reprendre sans le
 * réapprendre.
 */
export function EntetePage({
  titre,
  compte,
  sousTitre,
  children,
}: {
  titre: string;
  compte?: number;
  sousTitre?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-5 border-b border-line pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-titre-fiche">
          {titre}
          {compte !== undefined ? (
            <span className="ml-2 align-middle text-[15px] font-semibold text-dim">{compte}</span>
          ) : null}
        </h1>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
      {sousTitre ? <p className="mt-1.5 max-w-2xl text-meta text-dim">{sousTitre}</p> : null}
    </header>
  );
}

/** Rangée de filtres. Défile horizontalement plutôt que de passer à la ligne. */
export function BarreFiltres({
  legende,
  children,
}: {
  legende: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dim">{legende}</p>
      <div className="defilement-x gap-2 pb-1" role="group" aria-label={legende}>
        {children}
      </div>
    </div>
  );
}

/** Puce de filtre. `href` la rend navigable, sinon c'est une simple étiquette. */
export function PuceFiltre({
  href,
  actif,
  children,
  compte,
}: {
  href: string;
  actif: boolean;
  children: React.ReactNode;
  compte?: number;
}) {
  return (
    <Link href={href} className={clsx("puce", actif && "puce-active")} aria-current={actif ? "true" : undefined}>
      {children}
      {compte !== undefined ? (
        <span className={clsx("ml-1.5 text-[11px]", actif ? "text-on-gold/70" : "text-dim")}>{compte}</span>
      ) : null}
    </Link>
  );
}

/**
 * Bandeau d'alerte du tableau de bord. `ton` porte l'urgence, jamais une
 * décoration : rouge pour ce qui est visible du public et cassé, or pour ce
 * qui demande une action, neutre pour le reste.
 */
export function Bandeau({
  ton = "neutre",
  titre,
  action,
  children,
}: {
  ton?: "alerte" | "action" | "neutre";
  titre: string;
  action?: { libelle: string; href: string };
  children?: React.ReactNode;
}) {
  const bordure = {
    alerte: "border-l-vendu",
    action: "border-l-gold",
    neutre: "border-l-line",
  }[ton];
  return (
    <section className={clsx("carte border-l-[3px] p-4", bordure)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold">{titre}</h2>
        {action ? (
          <Link href={action.href} className="shrink-0 text-[12.5px] font-semibold text-gold-light">
            {action.libelle}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Pastille chiffrée, pour un compte qui doit se lire sans être lu. */
export function Pastille({ n, ton = "action" }: { n: number; ton?: "alerte" | "action" | "calme" }) {
  const style = {
    alerte: "bg-vendu text-white",
    action: "bg-gold text-on-gold",
    calme: "bg-surface-hi text-chrome",
  }[ton];
  return (
    <span className={clsx("ml-2 inline-flex min-w-[20px] justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-tight", style)}>
      {n}
    </span>
  );
}

export function VideAdmin({ titre, texte, children }: { titre: string; texte: string; children?: React.ReactNode }) {
  return (
    <div className="carte flex flex-col items-center gap-3 px-6 py-10 text-center">
      <h2 className="text-[17px] font-semibold">{titre}</h2>
      <p className="max-w-md text-corps text-chrome">{texte}</p>
      {children ? <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
