import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { analyserCsvMotos } from "@/lib/import-csv";
import { sessionCourante } from "@/lib/auth";
import { corpsJsonBorne } from "@/lib/securite";
import { verrouPublication } from "@/lib/publication";
import { estEnVente } from "@/lib/types";
import type { MotoInput } from "@/lib/schemas";
import { champsPrix, reglagesEnVigueur } from "@/lib/tarification-serveur";
import { prixDynamique } from "@/lib/tarification";

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

  const reglages = await reglagesEnVigueur();
  const analyse = analyserCsvMotos(corps.csv, reglages);

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

  // Le prix d'achat est une information réservée à l'administrateur : un
  // fichier qui en contient, importé par un autre compte, est refusé entier.
  if (session.role !== "admin" && analyse.motos.some((m) => m.prix_yuan)) {
    return Response.json(
      {
        erreur:
          "Import refusé : la colonne prix_yuan est réservée au compte administrateur. Laissez-la vide, l'administrateur la complétera.",
        champ: "prix_yuan",
      },
      { status: 403 }
    );
  }

  const pilote = db();
  const rapport: {
    reference: string;
    action: "cree" | "mis_a_jour";
    retenu_en_brouillon?: string[];
    sans_prix?: boolean;
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
      // Prix : une ligne sans prix d'achat ne doit pas effacer celui d'une
      // fiche existante, et une fiche au prix figé (réservée, vendue, au
      // local) garde le sien. Sans prix du tout, la fiche reste en brouillon.
      const existante = await pilote.motoParReference(moto.reference);
      const prixExistant = existante && {
        prix_ttc: existante.prix_ttc,
        prix_yuan: existante.prix_yuan,
        taux_yuan: existante.taux_yuan,
        acompte_pct: existante.acompte_pct,
      };
      let prix = { prix_ttc: moto.prix_ttc, prix_yuan: moto.prix_yuan ?? null, taux_yuan: moto.taux_yuan ?? null, acompte_pct: moto.acompte_pct ?? null };
      if (prixExistant && (!prixDynamique(existante.statut) || (!prix.prix_yuan && !existante.prix_yuan))) {
        prix = prixExistant;
      } else if (!prix.prix_yuan && existante?.prix_yuan) {
        prix = champsPrix(existante.prix_yuan, reglages);
      }

      // Statut : une fiche créée par import naît en brouillon — la mise en
      // vente se fait au back-office, une fois les photos en place. Une fiche
      // existante garde le sien : l'import met ses informations à jour sans
      // la retirer de la vente ni l'y mettre.
      const donnees = {
        ...moto,
        ...prix,
        statut: existante?.statut ?? "brouillon",
        fournisseur_id,
      } as MotoInput;
      const { moto: enregistree, cree } = await pilote.enregistrerParReference(donnees);

      // Une fiche déjà en vente que la mise à jour rendrait incomplète (une
      // description vidée, par exemple) repasse en brouillon, et le rapport
      // dit ce qui manque plutôt que de laisser en ligne une fiche non conforme.
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
        ...(enregistree.prix_ttc > 0 ? {} : { sans_prix: true }),
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
    sans_prix: rapport.filter((r) => r.sans_prix).length,
    rapport,
  });
}
