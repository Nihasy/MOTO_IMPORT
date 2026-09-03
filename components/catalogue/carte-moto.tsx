"use client";

import Link from "next/link";
import clsx from "clsx";
import type { MotoAvecMedias } from "@/lib/types";
import { LIBELLE_CATEGORIE } from "@/lib/types";
import { ar } from "@/lib/format";
import { lienDevis } from "@/lib/whatsapp";
import { BadgeStatut } from "@/components/ui";
import { BadgeNouveau } from "@/components/ui/badge-nouveau";
import { IconeBulle, IconeSignet } from "@/components/ui/navigation";
import { GalerieCarte } from "./galerie-carte";
import { useEnregistrees } from "./enregistrees";
import { enregistrerDemande, pister } from "@/lib/analytics";

export function CarteMoto({ moto }: { moto: MotoAvecMedias }) {
  const { contient, basculer, pret } = useEnregistrees();
  const enregistree = pret && contient(moto.id);
  const vendu = moto.statut === "vendu";
  const fiche = `/motos/${moto.slug}`;

  return (
    <article className="carte-produit">
      {/* En-tête : la marque prime, le modèle et l'année la précisent. */}
      <Link href={fiche} className="block px-4 pt-4 text-center">
        <h3 className="text-titre-carte uppercase text-text">
          {moto.marque}
        </h3>
        <p className="mt-1 text-[15px] font-semibold leading-[18px] text-chrome">
          {moto.modele} — {moto.annee}
        </p>
      </Link>

      <div className="relative px-4 pt-3">
        <div className="cadre-photo">
          <Link href={fiche} className="block" aria-label={`${moto.marque} ${moto.modele}`}>
            <GalerieCarte
              medias={moto.medias}
              total={moto.nb_medias ?? moto.medias.length}
              alt={`${moto.marque} ${moto.modele} ${moto.annee}`}
            />
          </Link>
        </div>
        <div className="pointer-events-none absolute inset-x-6 top-5 flex items-start justify-between gap-2">
          <BadgeStatut statut={moto.statut} />
          <BadgeNouveau creeLe={moto.created_at} />
        </div>
      </div>

      {/* Grille de caractéristiques : lecture en diagonale, comme sur une petite annonce. */}
      <div className="px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-4">
          <div className="ligne-spec">
            <dt className="sr-only">État</dt>
            <dd className={clsx("font-semibold", moto.etat === "neuf" ? "text-gold-light" : "text-dispo")}>
              {moto.etat === "neuf" ? "Neuf" : "Occasion"}
            </dd>
          </div>
          <div className="ligne-spec justify-end">
            <dt className="sr-only">Kilométrage</dt>
            <dd className="text-text">
              {moto.kilometrage !== null ? `${moto.kilometrage.toLocaleString("fr-FR")} km` : "0 km"}
            </dd>
          </div>

          <div className="ligne-spec">
            <dt className="sr-only">Cylindrée</dt>
            <dd className="text-text">
              {moto.cylindree} cm<sup className="text-[10px]">3</sup>
            </dd>
          </div>
          <div className="ligne-spec justify-end">
            <dt className="sr-only">Catégorie</dt>
            <dd className="text-text">{LIBELLE_CATEGORIE[moto.categorie]}</dd>
          </div>
        </dl>

        <p className="pt-1 text-meta font-semibold text-chrome">
          {moto.statut === "dispo_immediate"
            ? "Antananarivo · au local, livrable de suite"
            : `Antananarivo · ${moto.delai_min_jours} à ${moto.delai_max_jours} jours`}
        </p>
      </div>

      {/* Bandeau signature : accès à la fiche à gauche, prix traité comme un dossard à droite. */}
      <Link
        href={fiche}
        className={clsx("bande-prix mt-auto", vendu ? "bg-bg" : "bg-gradient-to-r from-gold to-gold-light")}
        aria-label={`Voir la fiche ${moto.marque} ${moto.modele}`}
      >
        <span className="bande-details">+ de détails</span>
        <span
          className={clsx(
            "pl-2 pr-4 text-prix-carte",
            vendu ? "text-dim line-through" : "text-on-gold"
          )}
        >
          {ar(moto.prix_ttc)}
        </span>
      </Link>

      <p className="border-b border-line px-4 py-2 text-center text-meta text-dim">
        Prix final rendu Antananarivo · Carte grise à votre nom
      </p>

      <div className="grid grid-cols-2">
        <button
          type="button"
          onClick={() => {
            basculer(moto.id);
            pister("enregistrement", { reference: moto.reference });
          }}
          aria-pressed={enregistree}
          className={clsx(
            "flex min-h-touch items-center justify-center gap-2 border-r border-line text-meta font-semibold transition-colors",
            enregistree ? "text-gold-light" : "text-chrome hover:text-text"
          )}
        >
          <IconeSignet rempli={enregistree} />
          {enregistree ? "Enregistrée" : "Enregistrer"}
        </button>
        <a
          href={lienDevis(moto)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            void enregistrerDemande({ moto_id: moto.id, reference: moto.reference });
            pister("clic_devis", { reference: moto.reference, vendu });
          }}
          className="flex min-h-touch items-center justify-center gap-2 text-meta font-semibold text-gold-light hover:text-gold"
        >
          <IconeBulle />
          {vendu ? "Trouvez-moi la même" : "Demander le devis"}
        </a>
      </div>
    </article>
  );
}
