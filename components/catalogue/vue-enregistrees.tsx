"use client";

import type { MotoAvecMedias } from "@/lib/types";
import { lienRecherche } from "@/lib/whatsapp";
import { useWhatsapp } from "@/components/ui/contexte-contact";
import { BarreSuperieure } from "@/components/ui/navigation";
import { EtatVide, Squelette } from "@/components/ui";
import { CarteMoto } from "./carte-moto";
import { useEnregistrees } from "./enregistrees";

export function VueEnregistrees({ motos }: { motos: MotoAvecMedias[] }) {
  const whatsapp = useWhatsapp();
  const { ids, pret } = useEnregistrees();
  const selection = motos.filter((m) => ids.includes(m.id));

  return (
    <>
      <BarreSuperieure titre="Enregistrées" />
      <main className="conteneur-large pb-28 pt-5">
        <h1 className="text-titre-fiche">Mes motos enregistrées</h1>
        <p className="mt-1 text-meta text-chrome">
          Sélection conservée sur cet appareil uniquement, sans compte ni inscription.
        </p>

        <div className="mt-5">
          {!pret ? (
            <div className="space-y-4">
              <Squelette className="h-64 w-full" />
              <Squelette className="h-64 w-full" />
            </div>
          ) : selection.length ? (
            <div className="grille-annonces">
              {selection.map((m) => (
                <CarteMoto key={m.id} moto={m} />
              ))}
            </div>
          ) : (
            <EtatVide
              titre="Aucune moto enregistrée"
              texte="Touchez « Enregistrer » sur une fiche pour la retrouver ici et comparer tranquillement avant de nous écrire."
              action={{ libelle: "Dites-nous ce que vous cherchez", href: lienRecherche(undefined, whatsapp) }}
            />
          )}
        </div>
      </main>
    </>
  );
}
