import Link from "next/link";
import clsx from "clsx";
import type { MotoAvecMedias, Statut } from "@/lib/types";
import { LIBELLE_CATEGORIE } from "@/lib/types";
import { dateFr } from "@/lib/format";
import { garantieCourte, garantieFiche } from "@/lib/garantie";
import { FOURCHETTE_ACOMPTE_TEXTE } from "@/lib/conditions";

export function Reassurance({ moto }: { moto: MotoAvecMedias }) {
  // La garantie n'apparaît que si le véhicule est réellement couvert : une
  // occasion, vendue en l'état, ne porte aucune ligne de garantie.
  const garantie = garantieFiche(moto);
  const lignes: LigneReassurance[] = [
    {
      titre: "Livraison",
      texte:
        moto.statut === "dispo_immediate"
          ? "Véhicule déjà au local d'Antananarivo, remise des clés dès le solde réglé"
          : `${moto.delai_min_jours} à ${moto.delai_max_jours} jours après signature du bon de commande`,
    },
    { titre: "Carte grise", texte: "Établie à votre nom, incluse dans le prix affiché" },
    ...(garantie ? [garantie] : []),
  ];

  return (
    <ul className="my-5 grid gap-2">
      {lignes.map((l) => (
        <li key={l.titre} className="flex gap-3 rounded-card border border-line bg-surface px-3.5 py-3">
          <span className="mt-0.5 text-gold" aria-hidden>
            ✓
          </span>
          <span className="text-corps">
            <strong className="font-semibold">{l.titre}</strong>
            <span className="block text-chrome">{l.texte}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

type LigneReassurance = { titre: string; texte: string };

export function FicheTechnique({ moto }: { moto: MotoAvecMedias }) {
  const lignes: [string, string | null][] = [
    ["Référence", moto.reference],
    ["Marque", moto.marque],
    ["Modèle", moto.modele],
    ["Année", String(moto.annee)],
    ["Cylindrée", `${moto.cylindree} cm³`],
    ["Catégorie", LIBELLE_CATEGORIE[moto.categorie]],
    ["État", moto.etat === "neuf" ? "Neuf" : "Occasion"],
    ["Kilométrage", moto.kilometrage !== null ? `${moto.kilometrage.toLocaleString("fr-FR")} km` : null],
    ["Puissance", moto.puissance_ch ? `${moto.puissance_ch} ch` : null],
    ["Poids", moto.poids_kg ? `${moto.poids_kg} kg` : null],
    ["Hauteur de selle", moto.hauteur_selle_mm ? `${moto.hauteur_selle_mm} mm` : null],
    ["Refroidissement", moto.refroidissement === "air" ? "Air" : moto.refroidissement === "liquide" ? "Liquide" : null],
    ["Transmission", moto.transmission],
    ["ABS", moto.abs ? "Oui" : "Non"],
    ["Couleur", moto.couleur],
    // Ligne toujours renseignée : « Aucune » est une réponse, pas une absence
    // de donnée. Les lignes nulles sont filtrées plus bas.
    ["Garantie", garantieCourte(moto)],
  ];
  return (
    <section className="my-6">
      <h2 className="mb-3 text-[17px] font-semibold">Fiche technique</h2>
      <dl className="overflow-hidden rounded-card border border-line">
        {lignes
          .filter(([, v]) => v)
          .map(([k, v], i) => (
            <div
              key={k}
              className={`flex justify-between gap-4 px-3.5 py-2.5 text-corps ${
                i % 2 ? "bg-surface" : "bg-surface-hi"
              }`}
            >
              <dt className="text-chrome">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

/** Bloc obligatoire pour l'occasion (CGV art. 3.4). */
export function EtatVehicule({ moto }: { moto: MotoAvecMedias }) {
  if (moto.etat !== "occasion") return null;
  const usures = moto.etat_details?.points_usure ?? [];
  return (
    <section className="my-6 rounded-card border border-line bg-surface p-4">
      <h2 className="text-[17px] font-semibold">État du véhicule</h2>
      <p className="mt-2 text-corps text-chrome">
        Kilométrage relevé au compteur :{" "}
        <strong className="text-text">{(moto.kilometrage ?? 0).toLocaleString("fr-FR")} km</strong>
      </p>
      {usures.length ? (
        <>
          <p className="mt-3 text-corps font-semibold">Points d&apos;usure constatés</p>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-corps text-chrome">
            {usures.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-corps text-chrome">
          Aucun point d&apos;usure notable relevé lors du contrôle au dépôt.
        </p>
      )}
      {moto.etat_details?.note ? (
        <p className="mt-3 text-corps text-chrome">{moto.etat_details.note}</p>
      ) : null}
      {moto.date_photos ? (
        <p className="mt-3 text-meta text-dim">
          Photos prises le {dateFr(moto.date_photos)} au dépôt, sur ce véhicule précis.
        </p>
      ) : null}
      <p className="mt-3 border-t border-line pt-3 text-meta text-dim">
        Ce véhicule est contrôlé avant expédition et décrit ici tel qu&apos;il a été constaté au
        dépôt.{" "}
        <Link href="/faq" className="text-gold-light underline">
          Voir la FAQ
        </Link>
      </p>
    </section>
  );
}

/**
 * Description rédigée (9.3, point 8).
 *
 * Elle n'était affichée nulle part : le texte saisi au back-office ne servait
 * qu'aux données structurées, invisibles du visiteur. Le paragraphe respecte les
 * sauts de ligne de l'auteur et disparaît si la fiche n'en porte pas, la
 * description étant facultative.
 */
export function Description({ moto }: { moto: MotoAvecMedias }) {
  const texte = moto.description?.trim();
  if (!texte) return null;
  return (
    <section className="my-6">
      {/* Le titre de la page porte déjà marque, modèle et année : le répéter
          ici en ferait un doublon pour le visiteur comme pour les moteurs. */}
      <h2 className="text-[17px] font-semibold">Description</h2>
      {texte.split(/\n{2,}/).map((paragraphe, i) => (
        <p key={i} className="mt-2.5 whitespace-pre-line text-corps leading-relaxed text-chrome">
          {paragraphe}
        </p>
      ))}
    </section>
  );
}

const ETAPES = [
  { titre: "Vous choisissez", texte: "Vous repérez une moto au catalogue et vous nous écrivez sur WhatsApp." },
  { titre: "Nous confirmons", texte: "Nous vérifions la disponibilité auprès de l'atelier et figeons le prix rendu Tana." },
  { titre: "Vous signez au local", texte: `Bon de commande signé sur place et acompte versé : de ${FOURCHETTE_ACOMPTE_TEXTE} selon la moto, indiqué sur sa fiche.` },
  { titre: "Nous importons", texte: "Sourcing, contrôle, expédition, dédouanement et carte grise à votre nom." },
  { titre: "Vous récupérez", texte: "Livraison en 45 à 65 jours, solde réglé à la remise des clés et des papiers." },
];

/**
 * Parcours d'un véhicule déjà au local. Ni sourcing, ni expédition, ni
 * dédouanement : les étapes du parcours d'importation décriraient un délai que
 * cette moto n'a pas, sur la page même où le reste de l'interface annonce
 * « livrable de suite ».
 */
const ETAPES_SUR_PLACE = [
  { titre: "Vous nous écrivez", texte: "Un message WhatsApp avec la référence. Nous confirmons que la moto est toujours au local." },
  { titre: "Vous venez la voir", texte: "Au local d'Antananarivo. Vous vérifiez le véhicule avant de vous engager, sans rien avancer." },
  { titre: "Vous signez sur place", texte: "Bon de commande signé au local, sans délai d'importation à attendre." },
  { titre: "Nous faisons la carte grise", texte: "Établie à votre nom, comprise dans le prix affiché." },
  { titre: "Vous repartez avec", texte: "Remise des clés dès le solde réglé." },
];

export function CommentCaSePasse({
  compact = false,
  statut,
  enLigne = false,
}: {
  compact?: boolean;
  statut?: Statut;
  /** Sur grand écran, les étapes se lisent de gauche à droite (accueil). */
  enLigne?: boolean;
}) {
  const surPlace = statut === "dispo_immediate";
  const etapes = surPlace ? ETAPES_SUR_PLACE : ETAPES;

  return (
    <section className={clsx("my-6", enLigne && "lg:my-10")}>
      <h2 className={clsx("mb-3 text-[17px] font-semibold", enLigne && "lg:mb-6 lg:text-[22px]")}>
        {surPlace ? "Comment ça se passe pour cette moto" : "Comment ça se passe"}
      </h2>
      {surPlace ? (
        <p className="mb-3 text-meta text-dim">
          Ce véhicule est déjà à Antananarivo : le parcours d&apos;importation en 45 à 65 jours ne
          s&apos;applique pas.
        </p>
      ) : null}
      <ol className={clsx("space-y-2.5", enLigne && "lg:grid lg:grid-cols-5 lg:gap-4 lg:space-y-0")}>
        {etapes.map((e, i) => (
          <li
            key={e.titre}
            className={clsx(
              "flex gap-3",
              enLigne && "lg:flex-col lg:gap-3 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:p-5"
            )}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold text-[15px] font-bold text-gold-light">
              {i + 1}
            </span>
            <span className="text-corps">
              <strong className="font-semibold">{e.titre}</strong>
              <span className="block text-chrome">{e.texte}</span>
            </span>
          </li>
        ))}
      </ol>
      {compact ? null : (
        <p className={clsx("mt-3 text-meta text-dim", enLigne && "lg:mt-5")}>
          <Link href="/faq" className="text-gold-light underline">
            En cas de désistement, l&apos;acompte reste acquis
          </Link>{" "}
          — voir la FAQ et les CGV.
        </p>
      )}
    </section>
  );
}

export const ETAPES_PROCESS = ETAPES;
