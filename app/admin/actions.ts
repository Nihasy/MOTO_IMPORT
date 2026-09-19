"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  authentifier,
  destinationSure,
  fermerSession,
  ouvrirSession,
  sessionCourante,
} from "@/lib/auth";
import { ipDepuisEntetes, limiterDebitDouble } from "@/lib/securite";
import { db } from "@/lib/db";
import { demandePatchSchema, mediaPatchSchema, motoSchema } from "@/lib/schemas";
import { messageVerrou, verrouPublication } from "@/lib/publication";
import { estEnVente } from "@/lib/types";
import { normaliserWhatsapp, parametresSchema } from "@/lib/schemas";
import type { DemandeStatut, Moto, Statut } from "@/lib/types";

/**
 * État renvoyé par les formulaires du back-office.
 *
 * `valeurs` renvoie la saisie telle qu'elle est arrivée. React vide tout
 * formulaire soumis par une action — `startHostTransition` demande un
 * `requestFormReset` avant même d'appeler l'action —, si bien qu'un refus du
 * serveur effaçait les vingt champs d'une fiche. `tentative` change à chaque
 * réponse : le formulaire s'en sert de clé pour se remonter avec la saisie
 * reprise, au lieu du formulaire vide que React vient de rétablir.
 */
export type EtatFormulaire = {
  erreur?: string;
  champ?: string;
  valeurs?: Record<string, string>;
  tentative?: number;
} | null;

/** Saisie brute, pour la rendre au formulaire en cas de refus. */
function valeursSaisies(form: FormData): Record<string, string> {
  const saisie: Record<string, string> = {};
  for (const [cle, valeur] of form.entries()) {
    if (typeof valeur === "string") saisie[cle] = valeur;
  }
  return saisie;
}

export async function connexion(_etat: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  // Sans limitation, deux comptes connus et un mot de passe a deviner suffisent
  // a monter une attaque par force brute sur le back-office.
  const ip = ipDepuisEntetes(await headers());
  const verdict = limiterDebitDouble(
    "connexion",
    ip,
    { max: 8, fenetreMs: 10 * 60_000 },
    { max: 40, fenetreMs: 10 * 60_000 }
  );
  if (!verdict.autorise) {
    return {
      erreur: `Trop de tentatives. Reessayez dans ${Math.ceil(verdict.resetDans / 60_000)} minutes.`,
    };
  }

  const email = String(form.get("email") ?? "");
  const motDePasse = String(form.get("motdepasse") ?? "");
  const session = authentifier(email, motDePasse);
  // Message unique : il ne doit pas permettre de distinguer un compte
  // inexistant d'un mot de passe errone.
  // L'adresse est rendue au formulaire : React le vide à chaque tentative, et
  // seul le mot de passe mérite d'être ressaisi.
  if (!session) {
    return {
      erreur: "Identifiants incorrects.",
      valeurs: { email },
      tentative: (_etat?.tentative ?? 0) + 1,
    };
  }

  await ouvrirSession(session);
  redirect(destinationSure(form.get("suite")));
}

export async function deconnexion() {
  await fermerSession();
  redirect("/connexion");
}

async function exigerSession() {
  const s = await sessionCourante();
  if (!s) redirect("/connexion");
  return s;
}

export async function enregistrerMoto(_etat: EtatFormulaire, form: FormData): Promise<EtatFormulaire> {
  await exigerSession();
  const id = String(form.get("id") ?? "");
  // Tout refus repart avec la saisie : sans cela React la vide et l'exploitant
  // doit ressaisir les vingt champs de la fiche.
  const refus = (erreur: string, champ?: string): EtatFormulaire => ({
    erreur,
    ...(champ ? { champ } : {}),
    valeurs: valeursSaisies(form),
    tentative: (_etat?.tentative ?? 0) + 1,
  });

  const existante = id ? await db().motoParId(id) : null;
  if (id && !existante) return refus("Moto introuvable : elle a pu être supprimée entre-temps.");
  const texte = (cle: string) => String(form.get(cle) ?? "").trim();
  const liste = (cle: string) =>
    texte(cle)
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);

  const brut = {
    reference: texte("reference"),
    marque: texte("marque"),
    modele: texte("modele"),
    annee: form.get("annee"),
    cylindree: form.get("cylindree"),
    categorie: form.get("categorie"),
    etat: form.get("etat"),
    // Le statut n'est pas un champ de ce formulaire : il a son sélecteur, sous
    // verrou de publication. Une création naît donc en brouillon, et une
    // modification conserve le statut en cours — quoi qu'annonce la requête,
    // qui peut avoir été fabriquée à la main.
    statut: existante?.statut ?? "brouillon",
    kilometrage: texte("kilometrage") ? form.get("kilometrage") : null,
    couleur: texte("couleur") || null,
    puissance_ch: texte("puissance_ch") ? form.get("puissance_ch") : null,
    poids_kg: texte("poids_kg") ? form.get("poids_kg") : null,
    hauteur_selle_mm: texte("hauteur_selle_mm") ? form.get("hauteur_selle_mm") : null,
    refroidissement: texte("refroidissement") || null,
    transmission: texte("transmission") || null,
    abs: form.get("abs") === "on",
    prix_ttc: form.get("prix_ttc"),
    prix_valable_jusqu_au: texte("prix_valable_jusqu_au"),
    delai_min_jours: form.get("delai_min_jours") || 45,
    delai_max_jours: form.get("delai_max_jours") || 65,
    garantie_mois: form.get("garantie_mois") || 0,
    garantie_texte: texte("garantie_texte") || null,
    description: texte("description"),
    points_forts: liste("points_forts"),
    etat_details: texte("points_usure") ? { points_usure: liste("points_usure") } : null,
    date_photos: texte("date_photos") || null,
    fournisseur_id: texte("fournisseur_id") || null,
    date_vente: texte("date_vente") || null,
  };

  const parse = motoSchema.safeParse(brut);
  if (!parse.success) {
    const i = parse.error.issues[0];
    return refus(i.message, String(i.path[0] ?? ""));
  }

  // Verrou de publication (7.1, 10.3). Une création naît en brouillon et ne
  // passe donc jamais par ici. Le cas visé est la fiche déjà en vente que la
  // modification rendrait incomplète : vider sa description ou effacer sa
  // garantie la laisserait en ligne, non conforme.
  if (estEnVente(parse.data.statut) && existante) {
    const medias = await db().mediasDeMoto(id);
    const candidate = { ...existante, ...parse.data } as Moto;
    const verrou = verrouPublication(candidate, medias, parse.data.statut);
    if (!verrou.autorise) {
      return refus(
        `Cette moto est en vente : ces modifications la rendraient incomplète. ` +
          verrou.bloquants.join(" · ") +
          ` — repassez-la en brouillon si vous voulez la retravailler.`
      );
    }
  }

  let destination = "/admin/motos";
  try {
    const moto = existante ? await db().majMoto(id, parse.data) : await db().creerMoto(parse.data);
    revalidatePath("/motos");
    revalidatePath(`/motos/${moto.slug}`);
    revalidatePath("/");
    revalidatePath("/admin/motos");
    revalidatePath(`/admin/motos/${moto.id}`);
    // Après une création, la fiche n'a pas encore de photos : l'étape suivante
    // est l'onglet qui les reçoit, avec la liste de ce qui reste à faire.
    if (!existante) destination = `/admin/motos/${moto.id}?onglet=photos`;
  } catch (e) {
    return refus((e as Error).message);
  }
  redirect(destination);
}

export type ResultatStatut =
  | { ok: true; statut: Statut; date_vente: string | null }
  | { ok: false; erreur: string; bloquants: string[] };

/**
 * Bascule de statut, sous verrou de publication (7.1, 10.3).
 *
 * Le refus est renvoyé plutôt que levé : une exception d'action serveur est
 * anonymisée en production, et l'exploitant verrait « une erreur est survenue »
 * au lieu de la liste des points à corriger.
 */
export async function changerStatut(id: string, statut: Statut): Promise<ResultatStatut> {
  await exigerSession();

  const avant = await db().motoParId(id);
  if (!avant) return { ok: false, erreur: "Moto introuvable", bloquants: [] };

  const verrou = verrouPublication(avant, await db().mediasDeMoto(id), statut);
  if (!verrou.autorise) {
    return { ok: false, erreur: messageVerrou(verrou.bloquants), bloquants: verrou.bloquants };
  }

  const moto = await db().majStatut(id, statut);
  revalidatePath("/motos");
  revalidatePath(`/motos/${moto.slug}`);
  revalidatePath("/");
  revalidatePath("/admin/motos");
  // La fiche d'administration affiche le statut, le lien public et les
  // contrôles : sans cette ligne elle reste sur l'état précédent.
  revalidatePath(`/admin/motos/${id}`);
  return { ok: true, statut: moto.statut, date_vente: moto.date_vente };
}

export async function supprimerMoto(form: FormData) {
  await exigerSession();
  await db().supprimerMoto(String(form.get("id") ?? ""));
  revalidatePath("/motos");
  revalidatePath("/admin/motos");
  redirect("/admin/motos");
}

export async function enregistrerFournisseur(form: FormData) {
  const s = await exigerSession();
  if (s.role !== "admin") return;
  const id = String(form.get("id") ?? "");
  const donnees = {
    nom: String(form.get("nom") ?? "").trim(),
    contact: String(form.get("contact") ?? "").trim() || null,
    ville_chine: String(form.get("ville_chine") ?? "").trim() || null,
    specialite: String(form.get("specialite") ?? "").trim() || null,
    notes: String(form.get("notes") ?? "").trim() || null,
  };
  if (!donnees.nom) return;
  if (id) await db().majFournisseur(id, donnees);
  else await db().creerFournisseur(donnees);
  revalidatePath("/admin/fournisseurs");
}

export async function supprimerFournisseur(form: FormData) {
  const s = await exigerSession();
  if (s.role !== "admin") return;
  await db().supprimerFournisseur(String(form.get("id") ?? ""));
  revalidatePath("/admin/fournisseurs");
}

export async function majDemande(form: FormData) {
  await exigerSession();
  const id = String(form.get("id") ?? "");
  const statut = form.get("statut");
  const notes = form.get("notes");

  // Validation avant écriture : un statut hors énumération arrivait jusqu'en
  // base par simple conversion de type.
  const parse = demandePatchSchema.safeParse({
    ...(statut ? { statut: String(statut) } : {}),
    ...(notes !== null ? { notes: String(notes) } : {}),
  });
  if (!parse.success) return;

  await db().majDemande(id, parse.data);
  revalidatePath("/admin/demandes");
  revalidatePath("/admin");
}

/** Déplacement d'une demande dans le kanban, en un geste et sans rechargement. */
export async function deplacerDemande(
  id: string,
  statut: DemandeStatut
): Promise<{ ok: boolean }> {
  await exigerSession();
  const parse = demandePatchSchema.safeParse({ statut });
  if (!parse.success) return { ok: false };
  try {
    await db().majDemande(id, parse.data);
  } catch {
    return { ok: false };
  }
  revalidatePath("/admin/demandes");
  revalidatePath("/admin");
  return { ok: true };
}

export async function reordonnerPhotos(motoId: string, ordre: string[]) {
  await exigerSession();
  await db().reordonnerMedias(motoId, ordre);
  revalidatePath(`/admin/motos/${motoId}`);
  return { ok: true };
}

export async function majPhoto(id: string, motoId: string, patch: Record<string, unknown>) {
  await exigerSession();
  // Liste blanche : sans elle, ce patch libre permettait de rattacher une
  // photo à une autre moto ou d'en réécrire l'ordre.
  const parse = mediaPatchSchema.safeParse(patch);
  if (!parse.success) {
    return { ok: false as const, erreur: parse.error.issues[0]?.message ?? "Champ non modifiable" };
  }
  await db().majMedia(id, parse.data);
  revalidatePath(`/admin/motos/${motoId}`);
  return { ok: true as const };
}

export async function supprimerPhoto(id: string, motoId: string) {
  await exigerSession();
  await db().supprimerMedia(id);
  revalidatePath(`/admin/motos/${motoId}`);
  return { ok: true };
}

export async function annulerLot(id: string) {
  const s = await exigerSession();
  if (s.role !== "admin") return { ok: false, erreur: "Réservé à l'administrateur" };
  const supprimes = await db().annulerLot(id);
  revalidatePath("/admin/import");
  revalidatePath("/motos");
  return { ok: true, supprimes };
}

/**
 * Coordonnées du local (Paramètres). Réservé à l'administrateur : le numéro
 * WhatsApp reçoit toutes les demandes de devis, un compte éditeur compromis ne
 * doit pas pouvoir les détourner.
 */
export async function enregistrerParametres(form: FormData) {
  const s = await exigerSession();
  if (s.role !== "admin") redirect("/admin");

  const jours = form.getAll("jours").map(String);
  const heures = form.getAll("heures").map(String);
  const horaires = jours
    .map((j, i) => ({ jours: j.trim(), heures: (heures[i] ?? "").trim() }))
    .filter((l) => l.jours || l.heures);

  const saisie = parametresSchema.safeParse({
    adresse: String(form.get("adresse") ?? "").trim(),
    horaires,
    whatsapp: normaliserWhatsapp(String(form.get("whatsapp") ?? "")),
    telephone: String(form.get("telephone") ?? "").trim(),
  });
  if (!saisie.success) {
    const probleme = saisie.error.issues[0];
    redirect(`/admin/parametres?erreur=${encodeURIComponent(probleme?.message ?? "Saisie invalide.")}`);
  }

  try {
    await db().enregistrerParametres(saisie.data);
  } catch (e) {
    console.error("[parametres] enregistrement impossible :", (e as Error).message);
    redirect(
      `/admin/parametres?erreur=${encodeURIComponent(
        "Enregistrement impossible. Si la table « parametres » n'existe pas encore, appliquez la migration 0008 dans Supabase."
      )}`
    );
  }
  // Adresse, horaires et numéros s'affichent sur tout le site public (liens de
  // devis de chaque carte compris) : toutes les pages sont régénérées.
  revalidatePath("/", "layout");
  redirect("/admin/parametres?ok=1");
}
