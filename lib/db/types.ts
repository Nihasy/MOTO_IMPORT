import type {
  Demande, DemandeStatut, Fournisseur, ImportLot, Media, Moto, MotoAvecMedias,
  MotoPublique, Parametres, Statut, Vue,
} from "@/lib/types";
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
    (Moto & { nb_photos: number; vues_manquantes: Vue[]; couverture: Media | null })[]
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
  ajouterMedias(medias: Omit<Media, "id" | "created_at">[], lotId?: string): Promise<Media[]>;
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

  creerLot(lot: Omit<ImportLot, "id" | "created_at">): Promise<ImportLot>;
  majLot(id: string, patch: Partial<ImportLot>): Promise<ImportLot>;
  listerLots(): Promise<ImportLot[]>;
  annulerLot(id: string): Promise<number>;
}

/** Retire toute trace de fournisseur avant exposition publique. */
export const publier = <T extends { fournisseur_id?: string | null }>(m: T): Omit<T, "fournisseur_id"> => {
  const { fournisseur_id: _ignore, ...reste } = m;
  return reste;
};

export type { MotoPublique, MotoAvecMedias };
