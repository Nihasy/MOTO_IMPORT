import type {
  Demande, DemandeStatut, Fournisseur, ImportLot, Media, Moto, MotoAvecMedias,
  MotoPublique, Parametres, Statut, Vue,
} from "@/lib/types";
import type { Reglages } from "@/lib/tarification";
import type { MotoInput } from "@/lib/schemas";

export type FiltresCatalogue = {
  categorie?: string[];
  etat?: string;
  prixMax?: number;
  prixMin?: number;
  marques?: string[];
  cylindrees?: string[];
  anneeMin?: number;
  anneeMax?: number;
  masquerVendues?: boolean;
  recherche?: string;
};

export interface Pilote {
  nom: "supabase" | "local";
  listerMotosPubliques(f?: FiltresCatalogue): Promise<MotoAvecMedias[]>;
  motoParSlug(slug: string): Promise<MotoAvecMedias | null>;
  motosSimilaires(slug: string, n: number): Promise<MotoAvecMedias[]>;
  slugsPublies(): Promise<{ slug: string; updated_at: string }[]>;
  incrementerVues(id: string): Promise<void>;

  /**
   * Liste d'administration. La couverture est renvoyee avec la ligne : la
   * reclamer moto par moto depuis la page produisait une requete par fiche,
   * soit soixante allers-retours a soixante motos.
   *
   * `vues_manquantes` suit la meme logique : l'ecran signale les fiches
   * incompletes, et le calculer ligne par ligne demanderait de recharger les
   * medias de chaque moto. Le compte de photos reste affiche a titre indicatif,
   * il ne conditionne plus rien.
   */
  listerMotosAdmin(): Promise<
    (Moto & { nb_photos: number; ordres_photos: number[]; vues_manquantes: Vue[]; couverture: Media | null })[]
  >;
  motoParId(id: string): Promise<Moto | null>;
  motoParReference(ref: string): Promise<Moto | null>;
  creerMoto(input: MotoInput): Promise<Moto>;
  /**
   * Cree la moto, ou met a jour celle qui porte deja cette reference.
   * Operation unique et atomique : un « lire puis ecrire » en deux temps
   * laisse une fenetre ou deux imports simultanes creent deux fiches.
   */
  enregistrerParReference(input: MotoInput): Promise<{ moto: Moto; cree: boolean }>;
  majMoto(id: string, input: Partial<MotoInput>): Promise<Moto>;
  majStatut(id: string, statut: Statut): Promise<Moto>;
  supprimerMoto(id: string): Promise<void>;

  mediasDeMoto(motoId: string): Promise<Media[]>;
  /**
   * `siOrdrePris` dit quoi faire quand la place (moto_id, ordre) est prise.
   * `decaler`, par défaut, range la photo après la dernière : c'est un ajout
   * depuis la fiche. `ignorer` la laisse tomber : un fichier nommé
   * `MI-058_03_34ad` désigne une place, et le renvoyer ne doit rien créer — le
   * décalage avait doublé les photos de huit fiches publiées le 25/09/2026.
   * Seules les photos réellement insérées sont renvoyées.
   */
  ajouterMedias(
    medias: Omit<Media, "id" | "created_at">[],
    lotId?: string,
    options?: { siOrdrePris?: "decaler" | "ignorer" }
  ): Promise<Media[]>;
  majMedia(id: string, patch: Partial<Media>): Promise<Media>;
  supprimerMedia(id: string): Promise<void>;
  reordonnerMedias(motoId: string, ordre: string[]): Promise<void>;

  creerDemande(d: Omit<Demande, "id" | "created_at" | "updated_at" | "statut"> & { statut?: DemandeStatut }): Promise<Demande>;
  listerDemandes(): Promise<Demande[]>;
  majDemande(id: string, patch: Partial<Demande>): Promise<Demande>;

  listerFournisseurs(): Promise<(Fournisseur & { nb_motos: number })[]>;
  fournisseurParNom(nom: string): Promise<Fournisseur | null>;
  creerFournisseur(f: Omit<Fournisseur, "id" | "created_at">): Promise<Fournisseur>;
  majFournisseur(id: string, patch: Partial<Fournisseur>): Promise<Fournisseur>;
  supprimerFournisseur(id: string): Promise<void>;

  /** `null` tant que rien n'a été enregistré : les valeurs par défaut s'appliquent. */
  lireParametres(): Promise<Parametres | null>;
  enregistrerParametres(p: Parametres): Promise<Parametres>;

  /** Réglages de tarification. Interne : jamais lus par une page publique. */
  lireTarification(): Promise<Reglages | null>;
  enregistrerTarification(r: Reglages): Promise<Reglages>;

  creerLot(lot: Omit<ImportLot, "id" | "created_at">): Promise<ImportLot>;
  majLot(id: string, patch: Partial<ImportLot>): Promise<ImportLot>;
  listerLots(): Promise<ImportLot[]>;
  annulerLot(id: string): Promise<number>;
}

type Interne = "fournisseur_id" | "prix_yuan" | "taux_yuan" | "mise_en_vente";

/**
 * Retire toute donnée interne avant exposition publique : le fournisseur, le
 * prix d'achat en yuan et le taux appliqué.
 */
export const publier = <
  T extends { fournisseur_id?: string | null; prix_yuan?: number | null; taux_yuan?: number | null; mise_en_vente?: string | null },
>(
  m: T
): Omit<T, Interne> => {
  const { fournisseur_id: _f, prix_yuan: _p, taux_yuan: _t, mise_en_vente: _m, ...reste } = m;
  return reste;
};

export type { MotoPublique, MotoAvecMedias };
