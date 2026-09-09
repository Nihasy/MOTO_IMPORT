import Link from "next/link";
import clsx from "clsx";
import type { Statut } from "@/lib/types";
import { LIBELLE_STATUT } from "@/lib/types";

// Etiquette sobre facon plaque : plaque sombre opaque, libelle en blanc, et un
// simple filet de couleur en bord gauche pour le statut. Aucun aplat vif ni flou,
// qui passent mal sur une photo de moto.
//
// Le libelle n'est pas tenu sur une seule ligne : « Disponible sur commande »
// depasse la largeur d'une carte de catalogue a quatre colonnes, ou d'un
// telephone quand le bandeau « Nouveau » l'accompagne. Il passe alors sur deux
// lignes plutot que de deborder du cadre photo.
export function BadgeStatut({ statut, className }: { statut: Statut; className?: string }) {
  const filet: Record<Statut, string> = {
    brouillon: "border-l-gold",
    dispo_immediate: "border-l-immediat",
    disponible: "border-l-dispo",
    reserve: "border-l-reserve",
    vendu: "border-l-vendu",
    archive: "border-l-dim",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center border-l-[3px] bg-bg px-2 py-1 text-badge font-bold uppercase leading-tight text-text",
        filet[statut],
        className
      )}
    >
      {LIBELLE_STATUT[statut]}
    </span>
  );
}

export function Filet({ className }: { className?: string }) {
  return <div className={clsx("h-px w-full bg-line", className)} aria-hidden />;
}

export function EtatVide({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte: string;
  action?: { libelle: string; href: string };
}) {
  return (
    <div className="carte flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-hi text-2xl"
        aria-hidden
      >
        ⚙
      </div>
      <h2 className="text-[17px] font-semibold">{titre}</h2>
      <p className="max-w-sm text-corps text-chrome">{texte}</p>
      {action ? (
        <a className="btn-or mt-2" href={action.href} target="_blank" rel="noopener noreferrer">
          {action.libelle}
        </a>
      ) : null}
    </div>
  );
}

export function Section({
  titre,
  children,
  action,
}: {
  titre: string;
  children: React.ReactNode;
  action?: { libelle: string; href: string };
}) {
  return (
    <section className="py-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold">{titre}</h2>
        {action ? (
          <Link href={action.href} className="text-[12.5px] font-semibold text-gold-light">
            {action.libelle}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Squelette({ className }: { className?: string }) {
  return <div className={clsx("squelette", className)} />;
}
