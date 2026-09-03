import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Demande, Fournisseur, ImportLot, Media, Moto, MotoAvecMedias, Statut,
} from "@/lib/types";
import { estPublic } from "@/lib/types";
import { construireSlug } from "@/lib/format";
import type { MotoInput } from "@/lib/schemas";
import type { FiltresCatalogue, Pilote } from "./types";
import { publier } from "./types";
import { appliquerFiltres, similaires, trierCatalogue } from "./filtres";

type Base = {
  motos: Moto[];
  medias: Media[];
  demandes: Demande[];
  fournisseurs: Fournisseur[];
  import_lots: ImportLot[];
};

const FICHIER = process.env.LOCAL_DB_PATH ?? path.join(process.cwd(), "data", "local-db.json");
const VIDE: Base = { motos: [], medias: [], demandes: [], fournisseurs: [], import_lots: [] };

let cache: Base | null = null;
let chargement: Promise<Base> | null = null;
let ecriture: Promise<void> = Promise.resolve();

/**
 * Lecture unique et partagee. Sans la promesse memorisee, deux requetes
 * concurrentes arrivant a froid liraient chacune le fichier et publieraient
 * deux objets distincts : les ecritures faites sur le premier seraient
 * silencieusement perdues.
 */
async function lire(): Promise<Base> {
  if (cache) return cache;
  if (!chargement) {
    chargement = (async () => {
      try {
        const brut = await fs.readFile(FICHIER, "utf8");
        return { ...VIDE, ...(JSON.parse(brut) as Partial<Base>) };
      } catch {
        return structuredClone(VIDE);
      }
    })();
  }
  cache = await chargement;
  return cache;
}

/**
 * Ecriture serialisee et atomique.
 *
 * Les ecritures sont chainees pour qu'aucune ne s'entrelace, et passent par un
 * fichier temporaire renomme : une interruption en cours d'ecriture laisserait
 * sinon un JSON tronque, donc un catalogue entierement perdu au redemarrage.
 */
async function ecrire(base: Base): Promise<void> {
  cache = base;
  ecriture = ecriture
    .then(async () => {
      await fs.mkdir(path.dirname(FICHIER), { recursive: true });
      const temporaire = `${FICHIER}.${process.pid}.tmp`;
      await fs.writeFile(temporaire, JSON.stringify(base, null, 2), "utf8");
      await fs.rename(temporaire, FICHIER);
    })
    .catch((e) => {
      // Une ecriture en echec ne doit pas rompre la chaine des suivantes.
      console.error("[magasin local] ecriture impossible :", (e as Error).message);
    });
  await ecriture;
}

export function viderCacheLocal() {
  cache = null;
  chargement = null;
}

const now = () => new Date().toISOString();
const jour = (d: unknown) => (typeof d === "string" && d ? d.slice(0, 10) : null);

function avecMedias(base: Base, m: Moto): MotoAvecMedias {
  const medias = base.medias
    .filter((x) => x.moto_id === m.id)
    .sort((a, b) => a.ordre - b.ordre);
  return { ...publier(m), medias };
}

function construireMoto(input: MotoInput): Moto {
  return {
    id: randomUUID(),
    reference: input.reference,
    slug: construireSlug(input.marque, input.modele, input.annee, input.reference),
    marque: input.marque,
    modele: input.modele,
    annee: input.annee,
    cylindree: input.cylindree,
    categorie: input.categorie,
    etat: input.etat,
    statut: input.statut ?? "brouillon",
    kilometrage: input.kilometrage ?? null,
    couleur: input.couleur ?? null,
    puissance_ch: input.puissance_ch ?? null,
    poids_kg: input.poids_kg ?? null,
    hauteur_selle_mm: input.hauteur_selle_mm ?? null,
    refroidissement: input.refroidissement ?? null,
    transmission: input.transmission ?? null,
    abs: input.abs ?? false,
    prix_ttc: input.prix_ttc,
    prix_valable_jusqu_au: input.prix_valable_jusqu_au,
    delai_min_jours: input.delai_min_jours ?? 45,
    delai_max_jours: input.delai_max_jours ?? 65,
    garantie_mois: input.garantie_mois ?? 0,
    garantie_texte: input.garantie_texte ?? null,
    description: input.description,
    points_forts: input.points_forts ?? [],
    etat_details: input.etat_details ?? null,
    date_photos: jour(input.date_photos),
    fournisseur_id: input.fournisseur_id ?? null,
    date_vente: jour(input.date_vente),
    vues: 0,
    created_at: now(),
    updated_at: now(),
  };
}

export function creerPiloteLocal(): Pilote {
  return {
    nom: "local",

    async listerMotosPubliques(f: FiltresCatalogue = {}) {
      const base = await lire();
      const motos = trierCatalogue(appliquerFiltres(base.motos.map((m) => publier(m)), f));
      return motos.map((m) => ({
        ...m,
        medias: base.medias.filter((x) => x.moto_id === m.id).sort((a, b) => a.ordre - b.ordre),
      }));
    },

    async motoParSlug(slug) {
      const base = await lire();
      const m = base.motos.find((x) => x.slug === slug && estPublic(x.statut));
      return m ? avecMedias(base, m) : null;
    },

    async motosSimilaires(slug, n) {
      const base = await lire();
      const ref = base.motos.find((x) => x.slug === slug);
      if (!ref) return [];
      const toutes = base.motos.map((m) => avecMedias(base, m));
      return similaires(toutes, avecMedias(base, ref), n);
    },

    async slugsPublies() {
      const base = await lire();
      return base.motos
        .filter((m) => estPublic(m.statut))
        .map((m) => ({ slug: m.slug, updated_at: m.updated_at }));
    },

    async incrementerVues(id) {
      const base = await lire();
      const m = base.motos.find((x) => x.id === id);
      if (!m) return;
      m.vues += 1;
      await ecrire(base);
    },

    async listerMotosAdmin() {
      const base = await lire();
      return base.motos
        .map((m) => {
          const siennes = base.medias
            .filter((x) => x.moto_id === m.id)
            .sort((a, b) => a.ordre - b.ordre);
          return { ...m, nb_photos: siennes.length, couverture: siennes[0] ?? null };
        })
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },

    async motoParId(id) {
      const base = await lire();
      return base.motos.find((m) => m.id === id) ?? null;
    },

    async motoParReference(ref) {
      const base = await lire();
      return base.motos.find((m) => m.reference === ref) ?? null;
    },

    async creerMoto(input) {
      const base = await lire();
      if (base.motos.some((m) => m.reference === input.reference)) {
        throw new Error(`Reference deja utilisee : ${input.reference}`);
      }
      const moto = construireMoto(input);
      base.motos.push(moto);
      await ecrire(base);
      return moto;
    },

    async enregistrerParReference(input) {
      const base = await lire();
      // Aucun `await` entre la recherche et l'ecriture : la section reste
      // indivisible vis-a-vis de la boucle d'evenements.
      const existante = base.motos.find((m) => m.reference === input.reference);
      if (existante) {
        const apres: Moto = { ...existante, ...(input as Partial<Moto>), updated_at: now() };
        apres.slug = construireSlug(apres.marque, apres.modele, apres.annee, apres.reference);
        if (apres.statut === "vendu" && !apres.date_vente) apres.date_vente = now().slice(0, 10);
        base.motos[base.motos.indexOf(existante)] = apres;
        await ecrire(base);
        return { moto: apres, cree: false };
      }
      const moto = construireMoto(input);
      base.motos.push(moto);
      await ecrire(base);
      return { moto, cree: true };
    },

    async majMoto(id, input) {
      const base = await lire();
      const i = base.motos.findIndex((m) => m.id === id);
      if (i < 0) throw new Error("Moto introuvable");
      const avant = base.motos[i];
      const apres: Moto = { ...avant, ...(input as Partial<Moto>), updated_at: now() };
      apres.slug = construireSlug(apres.marque, apres.modele, apres.annee, apres.reference);
      if (apres.statut === "vendu" && !apres.date_vente) apres.date_vente = now().slice(0, 10);
      base.motos[i] = apres;
      await ecrire(base);
      return apres;
    },

    async majStatut(id, statut: Statut) {
      const base = await lire();
      const m = base.motos.find((x) => x.id === id);
      if (!m) throw new Error("Moto introuvable");
      m.statut = statut;
      m.updated_at = now();
      if (statut === "vendu") {
        if (!m.date_vente) m.date_vente = now().slice(0, 10);
      } else {
        m.date_vente = null;
      }
      await ecrire(base);
      return m;
    },

    async supprimerMoto(id) {
      const base = await lire();
      base.motos = base.motos.filter((m) => m.id !== id);
      base.medias = base.medias.filter((x) => x.moto_id !== id);
      await ecrire(base);
    },

    async mediasDeMoto(motoId) {
      const base = await lire();
      return base.medias.filter((m) => m.moto_id === motoId).sort((a, b) => a.ordre - b.ordre);
    },

    async ajouterMedias(medias, lotId) {
      const base = await lire();
      const crees: Media[] = [];
      for (const m of medias) {
        const dejaPris = base.medias.some((x) => x.moto_id === m.moto_id && x.ordre === m.ordre);
        const ordre = dejaPris
          ? Math.max(0, ...base.medias.filter((x) => x.moto_id === m.moto_id).map((x) => x.ordre)) + 1
          : m.ordre;
        const media: Media = { ...m, ordre, id: randomUUID(), created_at: now(), lot_id: lotId ?? null };
        base.medias.push(media);
        crees.push(media);
      }
      await ecrire(base);
      return crees;
    },

    async majMedia(id, patch) {
      const base = await lire();
      const i = base.medias.findIndex((m) => m.id === id);
      if (i < 0) throw new Error("Media introuvable");
      base.medias[i] = { ...base.medias[i], ...patch };
      await ecrire(base);
      return base.medias[i];
    },

    async supprimerMedia(id) {
      const base = await lire();
      base.medias = base.medias.filter((m) => m.id !== id);
      await ecrire(base);
    },

    async reordonnerMedias(motoId, ordre) {
      const base = await lire();
      ordre.forEach((mediaId, i) => {
        const m = base.medias.find((x) => x.id === mediaId && x.moto_id === motoId);
        if (m) m.ordre = i + 1;
      });
      await ecrire(base);
    },

    async creerDemande(d) {
      const base = await lire();
      const demande: Demande = {
        id: randomUUID(),
        moto_id: d.moto_id ?? null,
        reference: d.reference ?? null,
        nom: d.nom ?? null,
        telephone: d.telephone ?? null,
        budget_max: d.budget_max ?? null,
        message: d.message ?? null,
        source: d.source ?? "direct",
        statut: d.statut ?? "nouveau",
        notes: d.notes ?? null,
        ip_hash: d.ip_hash ?? null,
        created_at: now(),
        updated_at: now(),
      };
      base.demandes.push(demande);
      await ecrire(base);
      return demande;
    },

    async listerDemandes() {
      const base = await lire();
      return [...base.demandes].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async majDemande(id, patch) {
      const base = await lire();
      const i = base.demandes.findIndex((d) => d.id === id);
      if (i < 0) throw new Error("Demande introuvable");
      base.demandes[i] = { ...base.demandes[i], ...patch, updated_at: now() };
      await ecrire(base);
      return base.demandes[i];
    },

    async listerFournisseurs() {
      const base = await lire();
      return base.fournisseurs.map((f) => ({
        ...f,
        nb_motos: base.motos.filter((m) => m.fournisseur_id === f.id).length,
      }));
    },

    async fournisseurParNom(nom) {
      const base = await lire();
      return base.fournisseurs.find((f) => f.nom.toLowerCase() === nom.toLowerCase()) ?? null;
    },

    async creerFournisseur(f) {
      const base = await lire();
      const fournisseur: Fournisseur = {
        id: randomUUID(),
        nom: f.nom,
        contact: f.contact ?? null,
        ville_chine: f.ville_chine ?? null,
        specialite: f.specialite ?? null,
        notes: f.notes ?? null,
        created_at: now(),
      };
      base.fournisseurs.push(fournisseur);
      await ecrire(base);
      return fournisseur;
    },

    async majFournisseur(id, patch) {
      const base = await lire();
      const i = base.fournisseurs.findIndex((f) => f.id === id);
      if (i < 0) throw new Error("Fournisseur introuvable");
      base.fournisseurs[i] = { ...base.fournisseurs[i], ...patch };
      await ecrire(base);
      return base.fournisseurs[i];
    },

    async supprimerFournisseur(id) {
      const base = await lire();
      base.fournisseurs = base.fournisseurs.filter((f) => f.id !== id);
      base.motos.forEach((m) => {
        if (m.fournisseur_id === id) m.fournisseur_id = null;
      });
      await ecrire(base);
    },

    async creerLot(lot) {
      const base = await lire();
      const l: ImportLot = { ...lot, id: randomUUID(), created_at: now() };
      base.import_lots.push(l);
      await ecrire(base);
      return l;
    },

    async majLot(id, patch) {
      const base = await lire();
      const i = base.import_lots.findIndex((l) => l.id === id);
      if (i < 0) throw new Error("Lot introuvable");
      base.import_lots[i] = { ...base.import_lots[i], ...patch };
      await ecrire(base);
      return base.import_lots[i];
    },

    async listerLots() {
      const base = await lire();
      return [...base.import_lots].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async annulerLot(id) {
      const base = await lire();
      const avant = base.medias.length;
      base.medias = base.medias.filter((m) => m.lot_id !== id);
      base.import_lots = base.import_lots.filter((l) => l.id !== id);
      await ecrire(base);
      return avant - base.medias.length;
    },
  };
}
