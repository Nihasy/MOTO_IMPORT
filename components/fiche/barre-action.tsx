"use client";

import clsx from "clsx";
import type { MotoAvecMedias } from "@/lib/types";
import { lienDevis } from "@/lib/whatsapp";
import { enregistrerDemande, pister } from "@/lib/analytics";
import { useEnregistrees } from "@/components/catalogue/enregistrees";
import { IconeBulle, IconeSignet } from "@/components/ui/navigation";

export function BarreActionFixe({ moto }: { moto: MotoAvecMedias }) {
  const { contient, basculer, pret } = useEnregistrees();
  const enregistree = pret && contient(moto.id);
  const vendu = moto.statut === "vendu";

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t border-line bg-bg/95 backdrop-blur">
      <div className="conteneur flex items-stretch gap-3 py-2.5">
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
      </div>
    </div>
  );
}
