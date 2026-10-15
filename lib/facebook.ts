import { z } from "zod";
import { DELAI_MAX, DELAI_MIN } from "./conditions";
import { ar, arCourt } from "./format";
import { SITE_URL } from "./site";
import {
  CATEGORIES, LIBELLE_CATEGORIE, miseEnVenteDe,
  type Categorie, type Etat, type Media, type MiseEnVente, type Moto, type PublicationFb, type Statut,
} from "./types";

/**
 * Statuts qu'on peut promouvoir. Plus étroit que `estEnVente`, qui compte aussi
 * `reserve` : une moto réservée a un acheteur et un contrat signé, la montrer
 * dans un album ferait écrire des gens pour une moto qui n'est plus à vendre.
 */
export const STATUTS_STUDIO = ["disponible", "dispo_immediate"] as const satisfies readonly Statut[];
export const estPromouvable = (s: Statut): boolean => (STATUTS_STUDIO as readonly string[]).includes(s);

/**
 * Studio Facebook : choisir des motos du catalogue, en tirer un album prêt à
 * publier sur la page. Ce fichier ne touche ni la base ni Facebook — il dit
 * quoi publier et avec quels mots ; `facebook-graph.ts` se charge de l'envoi.
 */

/**
 * Tranches de budget proposées au filtre. Seule source : le filtre, le titre
 * suggéré et la couverture de l'album les lisent ici. Bornes basses incluses,
 * hautes exclues, pour qu'une moto à 10 000 000 Ar tombe dans une seule.
 */
export const BUDGETS = [
  { cle: "moins-5m", libelle: "Moins de 5 M Ar", titre: "à moins de 5 M Ar", min: 0, max: 5_000_000 },
  { cle: "5-10m", libelle: "5 à 10 M Ar", titre: "de 5 à 10 M Ar", min: 5_000_000, max: 10_000_000 },
  { cle: "10-20m", libelle: "10 à 20 M Ar", titre: "de 10 à 20 M Ar", min: 10_000_000, max: 20_000_000 },
  { cle: "20-35m", libelle: "20 à 35 M Ar", titre: "de 20 à 35 M Ar", min: 20_000_000, max: 35_000_000 },
  { cle: "plus-35m", libelle: "35 M Ar et plus", titre: "à partir de 35 M Ar", min: 35_000_000, max: Infinity },
] as const;

export type CleBudget = (typeof BUDGETS)[number]["cle"];

export const estCleBudget = (v: string | undefined): v is CleBudget => BUDGETS.some((b) => b.cle === v);

export const budgetDe = (cle: CleBudget) => BUDGETS.find((b) => b.cle === cle)!;

export const dansBudget = (prix: number, cle: CleBudget): boolean => {
  const b = budgetDe(cle);
  return prix >= b.min && prix < b.max;
};

/** Fenêtres « nouveautés », en jours depuis l'entrée de la fiche au catalogue. */
export const FENETRES_NOUVEAUTE = [7, 14, 30] as const;

/**
 * Délai après lequel une moto déjà montrée redevient « à remontrer ». Un mois :
 * assez pour que l'audience de la page ait tourné, assez court pour qu'une
 * moto ne reste pas des semaines sans visibilité.
 */
export const JOURS_AVANT_REPUBLICATION = 30;

/**
 * Nombre de photos d'un album. Facebook en accepte davantage, mais le fil n'en
 * montre que quatre ou cinq et les suivantes ne sont presque jamais ouvertes :
 * au-delà de dix, mieux vaut deux albums.
 */
export const MAX_ALBUM = 10;
export const TAILLE_SELECTION_VARIEE = 6;

export type LigneStudio = Pick<
  Moto,
  | "id" | "reference" | "slug" | "marque" | "modele" | "annee" | "cylindree" | "categorie"
  | "etat" | "statut" | "kilometrage" | "prix_ttc" | "created_at" | "mise_en_vente"
> & { couverture: Media | null };

export type FiltresStudio = {
  /** Fiches entrées au catalogue depuis moins de N jours. */
  jours?: number;
  categories?: Categorie[];
  budget?: CleBudget;
  etat?: Etat;
  vente?: MiseEnVente;
  /** `jamais` : jamais publiée ; `ancienne` : pas publiée depuis un mois. */
  fraicheur?: "jamais" | "ancienne";
  q?: string;
};

export type Historique = Record<string, { nb: number; derniere: string }>;

/**
 * Passages de chaque moto sur la page. Une publication programmée compte dès
 * sa programmation : elle partira, et la remettre dans un autre album entre-temps
 * la montrerait deux fois la même semaine.
 */
export function historiqueParMoto(publications: PublicationFb[]): Historique {
  const h: Historique = {};
  for (const p of publications) {
    const date = p.programme_pour ?? p.created_at;
    for (const ref of p.refs) {
      const avant = h[ref];
      h[ref] = {
        nb: (avant?.nb ?? 0) + 1,
        derniere: avant && avant.derniere > date ? avant.derniere : date,
      };
    }
  }
  return h;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Filtres lus dans l'URL. Toute valeur hors liste est ignorée plutôt que
 * transmise : `?jours=-5` donnait une fenêtre négative, donc un Studio vide
 * sans explication.
 */
export function filtresDepuisParams(p: Record<string, string | string[] | undefined>): FiltresStudio {
  const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const jours = Number(un(p.jours));
  const budget = un(p.budget);
  const etat = un(p.etat);
  const vente = un(p.vente);
  const fraicheur = un(p.fraicheur);
  const q = un(p.q)?.trim().slice(0, 100);
  const categories = [...new Set(([] as string[]).concat(p.cat ?? []))].filter((c): c is Categorie =>
    (CATEGORIES as readonly string[]).includes(c)
  );
  return {
    jours: (FENETRES_NOUVEAUTE as readonly number[]).includes(jours) ? jours : undefined,
    categories,
    budget: estCleBudget(budget) ? budget : undefined,
    etat: etat === "neuf" || etat === "occasion" ? etat : undefined,
    vente: vente === "local" || vente === "commande" ? vente : undefined,
    fraicheur: fraicheur === "jamais" || fraicheur === "ancienne" ? fraicheur : undefined,
    q: q || undefined,
  };
}

/**
 * Motos que le Studio peut proposer. Seulement celles à vendre sur le site : le
 * lien de chaque photo mène à la fiche, et une fiche en brouillon, réservée ou
 * vendue ferait atterrir le lecteur sur une moto qu'il ne peut pas acheter. Une
 * moto sans photo est écartée, faute de quoi fabriquer sa carte.
 */
export function filtrerStudio(
  lignes: LigneStudio[],
  f: FiltresStudio,
  historique: Historique,
  maintenant = Date.now()
): LigneStudio[] {
  const mots = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return lignes
    .filter((m) => estPromouvable(m.statut) && m.couverture && m.prix_ttc > 0)
    .filter((m) => !f.jours || maintenant - new Date(m.created_at).getTime() <= f.jours * JOUR_MS)
    .filter((m) => !f.categories?.length || f.categories.includes(m.categorie))
    .filter((m) => !f.budget || dansBudget(m.prix_ttc, f.budget))
    .filter((m) => !f.etat || m.etat === f.etat)
    .filter((m) => !f.vente || miseEnVenteDe(m) === f.vente)
    .filter((m) => {
      if (!f.fraicheur) return true;
      const passe = historique[m.reference];
      if (f.fraicheur === "jamais") return !passe;
      return !passe || maintenant - new Date(passe.derniere).getTime() > JOURS_AVANT_REPUBLICATION * JOUR_MS;
    })
    .filter((m) => {
      if (!mots.length) return true;
      const texte = `${m.reference} ${m.marque} ${m.modele} ${m.annee}`.toLowerCase();
      return mots.every((w) => texte.includes(w));
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Sélection « variée » : un album de six Yamaha se lit comme un seul modèle.
 * On tourne entre les marques, la plus récente de chacune d'abord, puis on
 * range par prix croissant — l'œil compare mieux une échelle qu'un désordre.
 */
export function selectionVariee<T extends Pick<LigneStudio, "marque" | "prix_ttc" | "created_at">>(
  lignes: T[],
  n = TAILLE_SELECTION_VARIEE
): T[] {
  const parMarque = new Map<string, T[]>();
  for (const m of [...lignes].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const cle = m.marque.trim().toLowerCase();
    parMarque.set(cle, [...(parMarque.get(cle) ?? []), m]);
  }
  const files = [...parMarque.values()];
  const choisies: T[] = [];
  while (choisies.length < n && files.some((f) => f.length)) {
    for (const f of files) {
      const m = f.shift();
      if (m && choisies.length < n) choisies.push(m);
    }
  }
  return choisies.sort((a, b) => a.prix_ttc - b.prix_ttc);
}

/**
 * Lien d'une fiche, marqué pour la mesure. `utm_source=facebook` est ce que
 * `sourceVisiteur()` lit pour attribuer une demande à la page ; `utm_content`
 * porte la référence, pour savoir quelle photo de quel album a fait cliquer.
 */
export function lienFiche(m: Pick<LigneStudio, "slug" | "reference">, campagne: string): string {
  const p = new URLSearchParams({
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: campagne,
    utm_content: m.reference,
  });
  return `${SITE_URL}/motos/${m.slug}?${p}`;
}

/** Nom de campagne du jour : `album-20261015`. */
export const campagneDuJour = (d = new Date()): string =>
  `album-${d.toISOString().slice(0, 10).replace(/-/g, "")}`;

/**
 * Délai d'acheminement, dans les mots déjà validés pour la page. Les bornes
 * viennent de `conditions.ts` : une légende ne doit jamais promettre un autre
 * délai que le contrat.
 */
export const PHRASE_DELAI = `Tonga ao anatin'ny ${DELAI_MIN} ka hatramin'ny ${DELAI_MAX} andro.`;

const fiche = (m: Pick<LigneStudio, "cylindree" | "etat" | "kilometrage">) =>
  [
    `${m.cylindree} cm³`,
    m.etat === "neuf" ? "Neuve" : "Occasion",
    m.etat === "occasion" && m.kilometrage ? `${m.kilometrage.toLocaleString("fr-FR")} km` : null,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Mention de disponibilité. Une moto sur commande n'est jamais dite « à Tana » :
 * c'est la règle 11 du référentiel de contenu, et l'article 2 des CGV.
 */
export const mentionVente = (m: Pick<LigneStudio, "mise_en_vente" | "statut">): string =>
  miseEnVenteDe(m) === "local"
    ? "📍 Déjà au local à Tana, disponible de suite"
    : `📦 Sur commande · ${PHRASE_DELAI}`;

/** Légende propre à une photo de l'album : ce qu'on lit en ouvrant la photo. */
export function legendePhoto(m: LigneStudio, campagne: string): string {
  return [
    `${m.marque} ${m.modele} ${m.annee}`,
    fiche(m),
    `💰 ${ar(m.prix_ttc)}`,
    mentionVente(m),
    `Réf. ${m.reference}`,
    `👉 ${lienFiche(m, campagne)}`,
  ].join("\n");
}

/**
 * Texte de l'album. Les liens y sont rappelés un par un : dans le fil, on lit
 * le texte du post sans ouvrir les photos, et c'est de là que partent les clics.
 */
export function legendeAlbum(titre: string, motos: LigneStudio[], campagne: string): string {
  const lignes = motos.map(
    (m, i) => `${i + 1}. ${m.marque} ${m.modele} ${m.annee} — ${arCourt(m.prix_ttc)}\n👉 ${lienFiche(m, campagne)}`
  );
  const surCommande = motos.some((m) => miseEnVenteDe(m) === "commande");
  return [
    titre.trim(),
    lignes.join("\n\n"),
    surCommande ? `📦 ${PHRASE_DELAI}` : null,
    `Jereo ny catalogue : ${SITE_URL.replace(/^https?:\/\//, "")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Titre proposé d'après les filtres ; l'exploitant le réécrit à sa guise. */
export function titreSuggere(f: FiltresStudio): string {
  const libelle = f.categories?.length === 1 ? LIBELLE_CATEGORIE[f.categories[0]] : null;
  // « Cross » est invariable : pas de « Crosss ».
  const types = !libelle ? "Motos" : libelle.endsWith("s") ? libelle : `${libelle}s`;
  const morceaux = [
    f.jours ? `Nouveautés · ${types}` : types,
    f.etat === "neuf" ? "neuves" : f.etat === "occasion" ? "d'occasion" : null,
    f.budget ? budgetDe(f.budget).titre : null,
    f.vente === "local" ? "disponibles de suite" : null,
  ];
  return morceaux.filter(Boolean).join(" ");
}

/**
 * Bornes de programmation de l'API Graph pour une publication de Page : au
 * moins dix minutes après l'envoi, au plus trente jours. Hors de là, Facebook
 * refuse l'appel — et les photos auraient déjà été téléversées pour rien.
 */
export const PROGRAMMATION_MIN_MS = 10 * 60 * 1000;
export const PROGRAMMATION_MAX_MS = 30 * JOUR_MS;

export function erreurProgrammation(quand: Date, maintenant = Date.now()): string | null {
  if (Number.isNaN(quand.getTime())) return "Date de programmation illisible.";
  const ecart = quand.getTime() - maintenant;
  if (ecart < PROGRAMMATION_MIN_MS) return "Facebook exige au moins 10 minutes d'avance pour programmer.";
  if (ecart > PROGRAMMATION_MAX_MS) return "Facebook ne programme pas au-delà de 30 jours.";
  return null;
}

/**
 * Ventes à annoncer : pour chaque post passé par l'API et déjà en ligne, les
 * motos vendues depuis qui n'y ont pas encore reçu leur commentaire. Un post
 * programmé ne compte qu'une fois son heure passée — on ne commente pas un
 * post qui n'existe pas encore aux yeux du public.
 */
export function ventesASignaler(
  publications: PublicationFb[],
  vendues: Set<string>,
  maintenant = Date.now()
): { publication: PublicationFb; refs: string[] }[] {
  return publications
    .filter((p) => p.post_id)
    .filter((p) => !p.programme_pour || new Date(p.programme_pour).getTime() <= maintenant)
    .map((p) => ({
      publication: p,
      refs: p.refs.filter((r) => vendues.has(r) && !p.ventes_signalees.includes(r)),
    }))
    .filter((v) => v.refs.length > 0);
}

/**
 * Album tel que l'écran l'envoie, pour le kit comme pour la publication. Les
 * légendes arrivent relues et corrigées à la main : ce sont elles qui partent,
 * pas celles que le serveur saurait regénérer.
 */
export const MAX_TITRE = 90;

export const albumSchema = z.object({
  // Au-delà de trois lignes, le titre déborde de la carte de couverture.
  titre: z.string().trim().max(MAX_TITRE, `Titre limité à ${MAX_TITRE} caractères.`),
  message: z.string().trim().min(1, "Le texte du post est vide.").max(5000),
  couverture: z.boolean(),
  motos: z
    .array(
      z.object({
        ref: z.string().regex(/^MI-\d{3,}$/, "Référence de moto invalide."),
        legende: z.string().trim().max(2000, "Légende limitée à 2 000 caractères."),
      })
    )
    .min(1, "Aucune moto choisie.")
    .max(MAX_ALBUM, `Pas plus de ${MAX_ALBUM} motos par album.`)
    // L'écran l'empêche déjà ; l'action est un point d'entrée à part entière.
    .refine((l) => new Set(l.map((m) => m.ref)).size === l.length, "Une même moto figure deux fois dans l'album."),
});
export type Album = z.infer<typeof albumSchema>;

/** Nom de fichier des cartes, dans l'ordre de l'album : `01-MI-123.png`. */
export const nomCarte = (i: number, ref: string) => `${String(i).padStart(2, "0")}-${ref}.png`;

/** Fichier texte du kit : le post, puis la légende de chaque photo. */
export function texteKit(album: Album): string {
  const blocs = [`=== TEXTE DU POST ===\n\n${album.message}`];
  if (album.couverture) blocs.push(`=== ${nomCarte(0, "couverture")} ===\n\n(pas de légende)`);
  album.motos.forEach((m, i) => blocs.push(`=== ${nomCarte(i + 1, m.ref)} ===\n\n${m.legende}`));
  // Retours chariot Windows : le Bloc-notes d'un vieux poste affiche sinon tout
  // sur une ligne.
  return blocs.join("\n\n").replace(/\r?\n/g, "\r\n");
}

export function commentaireVente(motos: Pick<LigneStudio, "marque" | "modele" | "reference">[]): string {
  const noms = motos.map((m) => `${m.marque} ${m.modele} (réf. ${m.reference})`);
  return [
    `✅ VENDUE${motos.length > 1 ? "S" : ""} : ${noms.join(", ")}.`,
    `Jereo ny catalogue : ${SITE_URL.replace(/^https?:\/\//, "")}/motos`,
  ].join("\n");
}
