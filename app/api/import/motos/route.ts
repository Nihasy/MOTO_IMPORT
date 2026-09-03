import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { analyserCsvMotos } from "@/lib/import-csv";
import { sessionCourante } from "@/lib/auth";
import { corpsJsonBorne } from "@/lib/securite";
import { verrouPublication } from "@/lib/publication";
import { estEnVente } from "@/lib/types";
import type { MotoInput } from "@/lib/schemas";

/** Un lot d'import reste un geste humain : quelques dizaines de fiches. */
const MAX_CORPS = 2 * 1024 * 1024;
const MAX_LIGNES = 500;

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Import CSV. Validation intégrale avant toute écriture : une seule ligne
 * invalide rejette le fichier entier (règle 7.4).
 */
export async function POST(req: NextRequest) {
  const session = await sessionCourante();
  if (!session) return Response.json({ erreur: "Non autorisé" }, { status: 401 });

  const lu = await corpsJsonBorne<{ csv?: string; fichier_nom?: string }>(req, MAX_CORPS);
  if (!lu.ok) return Response.json({ erreur: lu.erreur, champ: "csv" }, { status: lu.statut });

  const corps = lu.donnees;
  if (!corps?.csv || typeof corps.csv !== "string") {
    return Response.json({ erreur: "Fichier CSV absent", champ: "csv" }, { status: 400 });
  }

  // Borne avant analyse : un fichier de plusieurs milliers de lignes
  // monopoliserait le processus et rendrait le site indisponible.
  const nbLignes = corps.csv.split(/\r?\n/).filter((l) => l.trim()).length - 1;
  if (nbLignes > MAX_LIGNES) {
    return Response.json(
      {
        erreur: `Import refuse : ${nbLignes} lignes, maximum ${MAX_LIGNES} par lot. Decoupez le fichier.`,
        champ: "csv",
      },
      { status: 413 }
    );
  }

  const analyse = analyserCsvMotos(corps.csv);

  if (!analyse.ok) {
    // Rien n'est écrit : le lot est journalisé en échec avec le détail des lignes.
    const lot = await db().creerLot({
      type: "motos_csv",
      fichier_nom: corps.fichier_nom ?? null,
      total: analyse.total,
      reussis: 0,
      echoues: analyse.total,
      rapport: { erreurs: analyse.erreurs },
      auteur_id: null,
    });
    return Response.json(
      {
        erreur: `Import refusé : ${analyse.erreurs.length} erreur(s). Aucune ligne n'a été écrite.`,
        lot_id: lot.id,
        erreurs: analyse.erreurs,
      },
      { status: 422 }
    );
  }

  const pilote = db();
  const rapport: {
    reference: string;
    action: "cree" | "mis_a_jour";
    retenu_en_brouillon?: string[];
  }[] = [];

  // Résolution des fournisseurs par nom, création si absent (règle 7.4).
  const cacheFournisseurs = new Map<string, string>();
  const resoudreFournisseur = async (nom?: string): Promise<string | null> => {
    if (!nom) return null;
    const cle = nom.toLowerCase();
    if (cacheFournisseurs.has(cle)) return cacheFournisseurs.get(cle)!;
    const existant = await pilote.fournisseurParNom(nom);
    const f = existant ?? (await pilote.creerFournisseur({ nom, contact: null, ville_chine: null, specialite: null, notes: null }));
    cacheFournisseurs.set(cle, f.id);
    return f.id;
  };

  try {
    for (const { fournisseur, ...moto } of analyse.motos) {
      const fournisseur_id = await resoudreFournisseur(fournisseur);
      const donnees = { ...moto, fournisseur_id } as MotoInput;
      const { moto: enregistree, cree } = await pilote.enregistrerParReference(donnees);

      // Le CSV sert justement à créer les fiches « avant même d'avoir les
      // photos » (7.4). Une ligne qui réclame un statut en vente est donc
      // retenue en brouillon tant que les contrôles du 10.3 ne passent pas :
      // l'import reste utile, la publication reste bloquée, et le rapport dit
      // exactement ce qui manque plutôt que de rejeter le fichier.
      let retenu: string[] | undefined;
      if (estEnVente(enregistree.statut)) {
        const medias = await pilote.mediasDeMoto(enregistree.id);
        const verrou = verrouPublication(enregistree, medias, enregistree.statut);
        if (!verrou.autorise) {
          await pilote.majStatut(enregistree.id, "brouillon");
          retenu = verrou.bloquants;
        }
      }

      rapport.push({
        reference: moto.reference,
        action: cree ? "cree" : "mis_a_jour",
        ...(retenu ? { retenu_en_brouillon: retenu } : {}),
      });
    }
  } catch (e) {
    return Response.json(
      { erreur: `Écriture interrompue : ${(e as Error).message}`, ecrites: rapport.length },
      { status: 500 }
    );
  }

  const lot = await pilote.creerLot({
    type: "motos_csv",
    fichier_nom: corps.fichier_nom ?? null,
    total: analyse.total,
    reussis: rapport.length,
    echoues: 0,
    rapport: { lignes: rapport },
    auteur_id: null,
  });

  revalidatePath("/motos");
  revalidatePath("/");

  return Response.json({
    ok: true,
    lot_id: lot.id,
    total: analyse.total,
    crees: rapport.filter((r) => r.action === "cree").length,
    mis_a_jour: rapport.filter((r) => r.action === "mis_a_jour").length,
    retenus_en_brouillon: rapport.filter((r) => r.retenu_en_brouillon).length,
    rapport,
  });
}
