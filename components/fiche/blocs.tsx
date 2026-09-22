import Link from "next/link";
import clsx from "clsx";
import type { MotoAvecMedias, Statut } from "@/lib/types";
import { LIBELLE_CATEGORIE } from "@/lib/types";
import { dateFr } from "@/lib/format";
import { garantieCourte, garantieFiche } from "@/lib/garantie";
import { FOURCHETTE_ACOMPTE_TEXTE, FOURCHETTE_DELAI_TEXTE, RETRAIT_JOURS } from "@/lib/conditions";

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
  { titre: "Vous choisissez", icone: "catalogue", texte: "Vous repérez une moto au catalogue et vous nous écrivez sur WhatsApp." },
  { titre: "Nous confirmons", icone: "etiquette", texte: "Nous vérifions la disponibilité auprès de l'atelier et figeons le prix rendu Tana." },
  { titre: "Vous signez au local", icone: "lieu", texte: `Bon de commande signé sur place et acompte versé : de ${FOURCHETTE_ACOMPTE_TEXTE} selon la moto, indiqué sur sa fiche.` },
  { titre: "Nous importons", icone: "bateau", texte: "Sourcing, contrôle, expédition et dédouanement. Le délai dépend de la ligne maritime empruntée." },
  // Pas de délai chiffré ici : le parcours est le même pour toutes les motos,
  // alors que chaque fiche porte sa propre fourchette. Un « 45 à 75 jours »
  // générique contredisait, sur la même page, le « 45 à 65 » de la moto lue.
  // Le délai reste sur la ligne de réassurance et sur la carte, où il est juste.
  { titre: "Vous récupérez", icone: "moto", texte: `Nous vous prévenons dès l'arrivée à Tana. Vous avez ${RETRAIT_JOURS} jours pour régler le solde et repartir avec les clés.` },
];

/**
 * Parcours d'un véhicule déjà au local. Ni sourcing, ni expédition, ni
 * dédouanement : les étapes du parcours d'importation décriraient un délai que
 * cette moto n'a pas, sur la page même où le reste de l'interface annonce
 * « livrable de suite ».
 */
const ETAPES_SUR_PLACE = [
  { titre: "Vous nous écrivez", icone: "message", texte: "Un message WhatsApp avec la référence. Nous confirmons que la moto est toujours au local." },
  { titre: "Vous venez la voir", icone: "lieu", texte: "Au local d'Antananarivo. Vous vérifiez le véhicule avant de vous engager, sans rien avancer." },
  { titre: "Vous signez sur place", icone: "catalogue", texte: "Bon de commande signé au local, sans délai d'importation à attendre." },
  { titre: "Nous faisons la carte grise", icone: "etiquette", texte: "Établie à votre nom, comprise dans le prix affiché." },
  { titre: "Vous repartez avec", icone: "moto", texte: "Remise des clés dès le solde réglé." },
];

/**
 * Parcours d'achat en cinq cartes.
 *
 * Reprise de la maquette : pastille numérotée pleine, pictogramme encadré,
 * titre en deux tons — premier mot en blanc, suite en or — et filet doré en
 * pied de carte. Le tout dans nos codes plutôt que ceux de la maquette : le
 * rayon de 5 px du site et non ses coins très arrondis, l'or #C08A2E, la
 * graisse d'Open Sans, aucune lueur portée. La maquette annonçait « simple,
 * rapide et sécurisée ! » ; le sous-titre dit plutôt ce que le visiteur va
 * lire, sans promesse de rapidité que le délai d'importation contredirait.
 *
 * Cinq cartes sur une grille de trois font deux rangées, 3 + 2, comme la
 * maquette. Sur la fiche produit, la colonne de 680 px n'en tient que deux de
 * front : la même grille y répond 2 + 2 + 1 sans réglage particulier.
 */
export function CommentCaSePasse({
  compact = false,
  statut,
  enLigne = false,
}: {
  compact?: boolean;
  statut?: Statut;
  /** Accueil : titre en grand, grille jusqu'à trois colonnes. */
  enLigne?: boolean;
}) {
  const surPlace = statut === "dispo_immediate";
  const etapes = surPlace ? ETAPES_SUR_PLACE : ETAPES;

  return (
    <section className={clsx("my-8", enLigne && "lg:my-14")}>
      <span
        aria-hidden
        className="mb-3 block h-[3px] w-12 -skew-x-[30deg] bg-gradient-to-r from-gold to-transparent"
      />
      {/* Le premier mot reste blanc, la suite passe en or : même partage que
          l'accroche d'accueil, pour que les deux titres se répondent. */}
      <h2
        className={clsx(
          "font-extrabold leading-[1.1] tracking-tight",
          enLigne ? "text-[28px] sm:text-[36px]" : "text-[22px] sm:text-[26px]"
        )}
      >
        Comment <span className="text-gold-light">ça se passe</span>
        {surPlace ? <span className="text-gold-light"> pour cette moto</span> : null}
      </h2>
      <p className={clsx("mt-2 text-chrome", enLigne ? "text-corps sm:text-[17px]" : "text-meta")}>
        {surPlace
          ? `Ce véhicule est déjà à Antananarivo : le parcours d'importation en ${FOURCHETTE_DELAI_TEXTE} ne s'applique pas.`
          : "Cinq étapes, du premier message à la remise des clés."}
      </p>

      <ol
        className={clsx(
          "mt-6 grid gap-3 sm:grid-cols-2",
          enLigne ? "lg:mt-8 lg:grid-cols-3 lg:gap-4" : "lg:gap-4"
        )}
      >
        {etapes.map((e, i) => {
          // Le titre se coupe après son premier mot : « Vous » puis
          // « signez au local ». Les deux jeux d'étapes commencent tous par
          // « Vous » ou « Nous », le partage tombe donc toujours juste.
          const [premier, ...suite] = e.titre.split(" ");
          return (
            <li key={e.titre} className="carte relative flex flex-col rounded-card p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 min-w-[36px] items-center justify-center rounded-card bg-gold px-2 text-[15px] font-extrabold text-on-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-card border border-gold/35 bg-surface-hi text-gold">
                  <IconeEtape nom={e.icone} />
                </span>
              </div>
              <h3 className="mt-4 text-[19px] font-bold leading-[1.2]">
                {premier} <span className="text-gold-light">{suite.join(" ")}</span>
              </h3>
              <p className="mt-2 text-meta text-chrome">{e.texte}</p>
              <span aria-hidden className="mt-4 block h-[3px] w-9 bg-gold/70" />
            </li>
          );
        })}
      </ol>

      {compact ? null : (
        <p className={clsx("mt-4 text-meta text-dim", enLigne && "lg:mt-6")}>
          <Link href="/faq" className="text-gold-light underline">
            En cas de désistement, l&apos;acompte reste acquis
          </Link>{" "}
          — voir la FAQ et les CGV.
        </p>
      )}
    </section>
  );
}

/* Pictogrammes au trait, même grille et même épaisseur que ceux de l'accroche
   d'accueil et de la barre de navigation. */
function IconeEtape({ nom }: { nom: string }) {
  const commun = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (nom) {
    case "catalogue":
      return (
        <svg {...commun}>
          <path d="M5 3.5h9l5 5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" />
          <path d="M13.5 3.5V9h5" />
          <circle cx="10" cy="13.5" r="2.6" />
          <path d="m12 15.5 2 2" />
        </svg>
      );
    case "etiquette":
      return (
        <svg {...commun}>
          <path d="M11.4 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.6a1.5 1.5 0 0 1-.44 1.06l-6.9 6.9a1.5 1.5 0 0 1-2.12 0l-7.1-7.1a1.5 1.5 0 0 1 0-2.12l6.9-6.9a1.5 1.5 0 0 1 1.06-.44Z" />
          <circle cx="16" cy="8" r="1.4" />
        </svg>
      );
    case "lieu":
      return (
        <svg {...commun}>
          <path d="M12 21s6.5-5.6 6.5-10.4A6.5 6.5 0 0 0 5.5 10.6C5.5 15.4 12 21 12 21Z" />
          <circle cx="12" cy="10.4" r="2.5" />
        </svg>
      );
    case "bateau":
      return (
        <svg {...commun}>
          <path d="M3 17.5c1.6 0 1.6 1.5 3.2 1.5s1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5" />
          <path d="M4.8 14.2 6 9.5h12l1.2 4.7a1.5 1.5 0 0 1-1 1.8l-5.7 1.7a1.5 1.5 0 0 1-.9 0l-5.7-1.7a1.5 1.5 0 0 1-1.1-1.8Z" />
          <path d="M9 9.5V6h6v3.5M12 4v2" />
        </svg>
      );
    case "message":
      return (
        <svg {...commun}>
          <path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1-4.6A8.5 8.5 0 1 1 20.5 12Z" />
          <path d="M8.5 11.5h7M8.5 14.5h4" />
        </svg>
      );
    default:
      return (
        <svg {...commun}>
          <circle cx="5.5" cy="16.5" r="3.5" />
          <circle cx="18.5" cy="16.5" r="3.5" />
          <path d="M5.5 16.5h4l4-6h-3M13.5 10.5 16 16.5M11 7.5h3l1.5 3" />
        </svg>
      );
  }
}

export const ETAPES_PROCESS = ETAPES;
