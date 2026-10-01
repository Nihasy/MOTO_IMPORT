import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Liste d'administration, lue une fois par rendu. Le gabarit du back-office la
 * lit pour ses pastilles, et la plupart des écrans la relisaient aussitôt :
 * deux lectures complètes de la base, photos comprises, par page affichée.
 * Réservé aux pages : une action qui vient d'écrire doit relire la base.
 */
export const motosAdmin = cache(() => db().listerMotosAdmin());
