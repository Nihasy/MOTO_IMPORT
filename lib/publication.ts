import type { Media, Moto, Statut } from "./types";
import { LIBELLE_VUE, estEnVente } from "./types";
import { compterMots } from "./format";
import { vuesManquantes } from "./medias";

export type Controle = { libelle: string; ok: boolean; detail?: string };

/**
 * Marqueur du paragraphe « déjà sur place » que `scripts/seed.mjs` ajoute aux
 * fiches en disponibilité immédiate. Le script étant en `.mjs`, la phrase y est
 * écrite en toutes lettres : ce motif doit rester en accord avec elle.
 */
const PROMESSE_SUR_PLACE = /déjà à Antananarivo/i;

/**
 * Contrôles avant publication (10.3).
 *
 * Vit dans `lib/` et non dans le composant qui l'affiche : ces contrôles sont
 * la barrière serveur du chapitre 7.1, appelée par l'action de bascule de
 * statut, par la route PATCH et par l'import CSV. Un contrôle qui ne vit que
 * dans un écran d'administration ne contrôle rien.
 */
export function controlesPublication(moto: Moto, medias: Media[]): Controle[] {
  const manquantes = vuesManquantes(medias, moto.etat);
  const mots = compterMots(moto.description);
  const sansAlt = medias.filter((m) => !m.alt?.trim());

  return [
    {
      libelle: "Photo de couverture définie",
      ok: medias.length > 0 && medias[0].vue === "34_avant_droit",
      detail: medias.length ? `Première vue : ${LIBELLE_VUE[medias[0].vue]}` : "Aucune photo",
    },
    {
      libelle: "Plan de prise de vue complet",
      ok: manquantes.length === 0,
      detail: manquantes.length
        ? `Manque : ${manquantes.map((v) => LIBELLE_VUE[v]).join(", ")}`
        : `${medias.length} photo${medias.length > 1 ? "s" : ""}, toutes les vues présentes`,
    },
    {
      libelle: "Description d'au moins 150 mots",
      ok: mots >= 150,
      detail: `${mots} mots`,
    },
    {
      libelle: "Prix et date de validité renseignés",
      ok: moto.prix_ttc > 0 && Boolean(moto.prix_valable_jusqu_au),
    },
    {
      libelle: "Kilométrage et date de photos (occasion)",
      ok: moto.etat === "neuf" || (moto.kilometrage !== null && Boolean(moto.date_photos)),
      detail: moto.etat === "neuf" ? "Non applicable" : undefined,
    },
    // SAV : seul le neuf est garanti, selon la marque et le concessionnaire.
    // Pour une occasion, le contrôle vérifie l'inverse — aucune couverture ne
    // doit avoir été saisie, sans quoi la fiche promet un SAV inexistant.
    moto.etat === "neuf"
      ? {
          libelle: "Garantie renseignée : durée et organes couverts",
          ok: moto.garantie_mois > 0 && Boolean(moto.garantie_texte?.trim()),
          detail:
            moto.garantie_mois > 0
              ? moto.garantie_texte?.trim()
                ? `${moto.garantie_mois} mois — ${moto.garantie_texte.trim()}`
                : `${moto.garantie_mois} mois — organes couverts à saisir`
              : "Durée à saisir, selon la marque et le concessionnaire",
        }
      : {
          libelle: "Aucune garantie saisie (occasion)",
          ok: moto.garantie_mois === 0 && !moto.garantie_texte?.trim(),
          detail: "Une occasion est vendue en l'état, sans garantie",
        },
    {
      libelle: "Texte alternatif sur toutes les photos",
      ok: sansAlt.length === 0,
      detail: sansAlt.length ? `${sansAlt.length} photo(s) sans texte alternatif` : undefined,
    },
    // La description est du texte libre : elle ne suit pas le statut. Une fiche
    // rédigée « disponible de suite » puis repassée en commande continuerait à
    // promettre une remise de clés immédiate, sur la page même où le reste de
    // l'interface annonce 45 à 65 jours. Le contrôle attrape la contradiction
    // plutôt que de laisser le client la découvrir.
    {
      libelle: "Description cohérente avec le statut",
      ok: !(PROMESSE_SUR_PLACE.test(moto.description) && moto.statut !== "dispo_immediate"),
      detail: PROMESSE_SUR_PLACE.test(moto.description)
        ? moto.statut === "dispo_immediate"
          ? "Annonce une disponibilité immédiate, conforme au statut"
          : "La description annonce un véhicule déjà sur place : retirez ce paragraphe ou repassez la moto en « Disponible de suite »"
        : undefined,
    },
  ];
}

export type Verrou = { autorise: boolean; bloquants: string[] };

/**
 * Verrou de publication : la seule fonction autorisée à dire oui.
 *
 * Seuls les statuts qui proposent activement le véhicule sont conditionnés.
 * `vendu` et `archive` passent toujours : marquer une moto vendue est le geste
 * le plus fréquent de l'exploitation (10.2), fait depuis un téléphone juste
 * après une signature, et le refuser laisserait au catalogue une moto qui
 * n'existe plus — exactement le dommage que le reste du chapitre cherche à
 * éviter. Repasser en `brouillon` est toujours permis : c'est la marche
 * arrière.
 */
export function verrouPublication(moto: Moto, medias: Media[], cible: Statut): Verrou {
  if (!estEnVente(cible)) return { autorise: true, bloquants: [] };
  const bloquants = controlesPublication(moto, medias)
    .filter((c) => !c.ok)
    .map((c) => (c.detail ? `${c.libelle} — ${c.detail}` : c.libelle));
  return { autorise: bloquants.length === 0, bloquants };
}

/** Message d'erreur normalisé, affichable tel quel au back-office. */
export function messageVerrou(bloquants: string[]): string {
  return (
    `Publication refusée : ${bloquants.length} point${bloquants.length > 1 ? "s" : ""} à corriger. ` +
    bloquants.join(" · ")
  );
}
