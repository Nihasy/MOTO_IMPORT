import { z } from "zod";
import {
  CATEGORIES, DEMANDE_SOURCES, DEMANDE_STATUTS, ETATS, ORIGINES, STATUTS, VUES,
} from "./types";

export const referenceSchema = z
  .string()
  .regex(/^MI-\d{3,}$/, "Référence attendue au format MI-047");

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

export const motoSchema = z
  .object({
    reference: referenceSchema,
    marque: z.string().min(1, "Marque obligatoire"),
    modele: z.string().min(1, "Modèle obligatoire"),
    annee: z.coerce.number().int().min(1990).max(2100),
    cylindree: z.coerce.number().int().positive(),
    categorie: z.enum(CATEGORIES),
    etat: z.enum(ETATS),
    // Une fiche naît en brouillon : la publication est un geste explicite, et
    // elle est refusée tant que les contrôles du 10.3 ne sont pas verts.
    statut: z.enum(STATUTS).default("brouillon"),

    kilometrage: z.coerce.number().int().min(0).nullable().optional(),
    couleur: z.string().nullable().optional(),
    puissance_ch: z.coerce.number().int().positive().nullable().optional(),
    poids_kg: z.coerce.number().int().positive().nullable().optional(),
    hauteur_selle_mm: z.coerce.number().int().positive().nullable().optional(),
    refroidissement: z.enum(["air", "liquide"]).nullable().optional(),
    transmission: z.string().nullable().optional(),
    abs: z.coerce.boolean().default(false),

    prix_ttc: z.coerce.number().int().positive("Prix obligatoire, en Ariary"),
    prix_valable_jusqu_au: dateSchema,
    delai_min_jours: z.coerce.number().int().positive().default(45),
    delai_max_jours: z.coerce.number().int().positive().default(65),

    garantie_mois: z.coerce.number().int().min(0).default(0),
    garantie_texte: z.string().nullable().optional(),

    // Facultative : une fiche peut naître, et même partir en ligne, sans texte.
    // Le vide est une valeur valide, pas une absence — d'où le repli sur "".
    description: z.string().default(""),
    points_forts: z.array(z.string()).default([]),
    etat_details: z
      .object({ points_usure: z.array(z.string()).optional(), note: z.string().optional() })
      .nullable()
      .optional(),
    date_photos: dateSchema.nullable().optional(),

    fournisseur_id: z.string().uuid().nullable().optional(),
    date_vente: dateSchema.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.etat === "occasion" && (v.kilometrage === null || v.kilometrage === undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["kilometrage"], message: "Kilométrage obligatoire pour une occasion" });
    }
    if (v.etat === "occasion" && !v.date_photos) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_photos"], message: "Date de prise de vue obligatoire pour une occasion (CGV art. 3.4)" });
    }
    if (v.statut === "vendu" && !v.date_vente) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_vente"], message: "Date de vente obligatoire quand le statut est vendu" });
    }
    if (v.delai_max_jours < v.delai_min_jours) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["delai_max_jours"], message: "Délai maximum inférieur au délai minimum" });
    }
    // SAV : seul le neuf est garanti, dans les termes fixés par la marque et le
    // concessionnaire. Une occasion est vendue en l'état, sans garantie (CGV
    // art. 8) : la saisie est refusée plutôt que corrigée en silence, pour que
    // personne ne puisse promettre au client une couverture qui n'existe pas.
    if (v.etat === "occasion" && v.garantie_mois > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["garantie_mois"],
        message: "Une occasion est vendue sans garantie : laissez 0",
      });
    }
    if (v.etat === "occasion" && v.garantie_texte?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["garantie_texte"],
        message: "Une occasion est vendue sans garantie : laissez ce champ vide",
      });
    }
  });

export type MotoInput = z.infer<typeof motoSchema>;

export const statutPatchSchema = z.object({ statut: z.enum(STATUTS) });

export const demandeSchema = z.object({
  moto_id: z.string().uuid().nullable().optional(),
  reference: z.string().max(32).nullable().optional(),
  nom: z.string().max(120).nullable().optional(),
  telephone: z.string().max(32).nullable().optional(),
  budget_max: z.coerce.number().int().positive().nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
  source: z.enum(DEMANDE_SOURCES).default("direct"),
});

export const demandePatchSchema = z.object({
  statut: z.enum(DEMANDE_STATUTS).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

/**
 * Champs d'un média modifiables depuis le back-office.
 *
 * Liste blanche volontaire : `moto_id`, `ordre`, `cloudinary_id` et les
 * dimensions n'y figurent pas. Sans elle, un patch libre laisserait un compte
 * authentifié rattacher une photo à une autre moto ou casser l'unicité de
 * l'ordre, par accident autant que par malveillance (11 : validation Zod
 * systématique en entrée).
 */
export const mediaPatchSchema = z
  .object({
    vue: z.enum(VUES).optional(),
    origine: z.enum(ORIGINES).optional(),
    alt: z.string().max(300).optional(),
    legende: z.string().max(300).nullable().optional(),
    date_prise: dateSchema.nullable().optional(),
  })
  .strict();

export const mediaSchema = z.object({
  moto_id: z.string().uuid(),
  type: z.enum(["photo", "video"]).default("photo"),
  origine: z.enum(ORIGINES).default("reelle"),
  vue: z.enum(VUES).default("autre"),
  cloudinary_id: z.string().min(1),
  largeur: z.coerce.number().int().positive(),
  hauteur: z.coerce.number().int().positive(),
  blurhash: z.string().nullable().optional(),
  ordre: z.coerce.number().int().min(1),
  legende: z.string().nullable().optional(),
  alt: z.string().min(1, "Texte alternatif obligatoire"),
  date_prise: dateSchema.nullable().optional(),
});

export const importMediasSchema = z.object({
  fichier_nom: z.string().optional(),
  medias: z.array(mediaSchema).min(1, "Aucun média à enregistrer"),
});

export const fournisseurSchema = z.object({
  nom: z.string().min(1),
  contact: z.string().nullable().optional(),
  ville_chine: z.string().nullable().optional(),
  specialite: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/** Ligne CSV brute -> moto. Tolère les colonnes vides. */
export const ligneCsvSchema = z.object({
  reference: referenceSchema,
  marque: z.string().min(1),
  modele: z.string().min(1),
  annee: z.coerce.number().int().min(1990).max(2100),
  cylindree: z.coerce.number().int().positive(),
  categorie: z.enum(CATEGORIES),
  etat: z.enum(ETATS),
  kilometrage: z.string().optional(),
  couleur: z.string().optional(),
  puissance_ch: z.string().optional(),
  poids_kg: z.string().optional(),
  hauteur_selle_mm: z.string().optional(),
  refroidissement: z.string().optional(),
  transmission: z.string().optional(),
  abs: z.string().optional(),
  prix_ttc: z.coerce.number().int().positive(),
  prix_valable_jusqu_au: dateSchema,
  garantie_mois: z.string().optional(),
  garantie_texte: z.string().optional(),
  description: z.string().optional(),
  points_forts: z.string().optional(),
  fournisseur: z.string().optional(),
  statut: z.string().optional(),
  date_photos: z.string().optional(),
});

export const filtresSchema = z.object({
  cat: z.string().optional(),
  etat: z.string().optional(),
  max: z.coerce.number().int().positive().optional(),
  min: z.coerce.number().int().min(0).optional(),
  marque: z.string().optional(),
  cc: z.string().optional(),
  annee_min: z.coerce.number().int().optional(),
  annee_max: z.coerce.number().int().optional(),
  masquer_vendues: z.string().optional(),
  q: z.string().optional(),
});
