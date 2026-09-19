"use client";

import clsx from "clsx";
import type { MotoAvecMedias } from "@/lib/types";
import { lienDevis } from "@/lib/whatsapp";
import { enregistrerDemande, pister } from "@/lib/analytics";
import { useEnregistrees } from "@/components/catalogue/enregistrees";
import { IconeBulle, IconeSignet } from "@/components/ui/navigation";
import { useChromeVisible } from "@/components/ui/masquage-au-scroll";

export function BarreActionFixe({ moto }: { moto: MotoAvecMedias }) {
  const chromeVisible = useChromeVisible();

  return (
    // Posee 64 px au-dessus du bord, c'est-a-dire sur la navigation. Quand
    // celle-ci s'efface, elle descend prendre sa place au lieu de flotter.
    // Elle ne s'escamote pas elle-meme : « Demander le devis » est l'action
    // que toute la fiche cherche a provoquer.
    // Sur ordinateur, les memes boutons vivent dans le panneau lateral
    // (`ActionsFiche`) : la barre fixe n'y a plus lieu d'etre.
    <div
      className={clsx(
        "fixed inset-x-0 bottom-16 z-40 border-t border-line bg-bg/95 backdrop-blur lg:hidden",
        "transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
        !chromeVisible && "translate-y-16"
      )}
    >
      <div className="conteneur flex items-stretch gap-3 py-2.5">
        <BoutonsAction moto={moto} />
      </div>
    </div>
  );
}

/** Les deux actions de la fiche, dans le panneau lateral sur ordinateur. */
export function ActionsFiche({ moto }: { moto: MotoAvecMedias }) {
  return (
    <div className="hidden items-stretch gap-3 lg:flex">
      <BoutonsAction moto={moto} />
    </div>
  );
}

function BoutonsAction({ moto }: { moto: MotoAvecMedias }) {
  const { contient, basculer, pret } = useEnregistrees();
  const enregistree = pret && contient(moto.id);
  const vendu = moto.statut === "vendu";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          basculer(moto.id);
          pister("enregistrement", { reference: moto.reference });
        }}
        aria-pressed={enregistree}
        className={clsx("btn-fantome shrink-0 px-4", enregistree && "border-gold text-gold-light")}
      >
        <IconeSignet rempli={enregistree} />
        <span className="sr-only sm:not-sr-only">{enregistree ? "Enregistrée" : "Enregistrer"}</span>
      </button>
      <a
        href={lienDevis(moto)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          void enregistrerDemande({ moto_id: moto.id, reference: moto.reference });
          pister("clic_devis", { reference: moto.reference, vendu });
        }}
        className="btn-or flex-1"
      >
        <IconeBulle />
        {vendu ? "Trouvez-moi la même" : "Demander le devis"}
      </a>
    </>
  );
}
