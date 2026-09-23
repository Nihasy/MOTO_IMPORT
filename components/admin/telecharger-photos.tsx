"use client";

import { useState } from "react";
import type { Media, Moto } from "@/lib/types";
import { urlTelechargement } from "@/lib/cloudinary";
import { nomTelechargement } from "@/lib/medias";
import { fileDEnvoi } from "@/lib/upload-client";

type Etat = "pret" | "preparation" | "aPartager" | "fini" | "echec";

/**
 * Récupère en une fois toutes les photos d'une moto, filigranées, pour les
 * republier sur Facebook.
 *
 * Deux chemins, selon l'appareil. Sur un téléphone, un téléchargement classique
 * ne sert à rien : le fichier atterrit dans les documents, pas dans la
 * pellicule, et Facebook ne va pas l'y chercher. On passe donc par le partage
 * natif, qui offre « Enregistrer les images » et l'envoi direct vers Facebook.
 * Sur un ordinateur, l'inverse : le partage natif n'a pas d'intérêt, et
 * Cloudinary sait annoncer chaque photo en pièce jointe.
 */
export function TelechargerPhotos({ moto, medias }: { moto: Moto; medias: Media[] }) {
  const [etat, setEtat] = useState<Etat>("pret");
  const [faits, setFaits] = useState(0);
  const [prets, setPrets] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const total = medias.length;
  if (!total) return null;

  const pluriel = (n: number) => (n > 1 ? "s" : "");

  const cible = (m: Media) => {
    const nom = nomTelechargement(moto.reference, moto.marque, moto.modele, m.ordre);
    return { nom, url: urlTelechargement(m.cloudinary_id, { origine: m.origine, nom }) };
  };

  /**
   * Le partage natif ne vaut que sur un écran tactile. Chrome le propose aussi
   * sous Windows, où il ouvre un sélecteur d'applications dont personne n'a
   * besoin ici : sur un ordinateur, on veut des fichiers dans le dossier de
   * téléchargement.
   */
  const surTelephone = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File(["sonde"], "t.jpg", { type: "image/jpeg" })] });

  const telechargerUnParUn = () => {
    medias.forEach((m, i) => {
      // Un délai entre deux ouvertures : enchaînés dans la même boucle, les
      // navigateurs ne retiennent que le premier téléchargement.
      setTimeout(() => {
        const lien = document.createElement("a");
        lien.href = cible(m).url;
        lien.rel = "noopener";
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
      }, i * 400);
    });
    setEtat("fini");
    setMessage(`${total} téléchargement${pluriel(total)} lancé${pluriel(total)}.`);
  };

  const partager = async (fichiers: File[]) => {
    await navigator.share({
      files: fichiers,
      title: `${moto.reference} · ${moto.marque} ${moto.modele}`,
    });
    setEtat("fini");
    setPrets([]);
    setMessage(
      `${fichiers.length} photo${pluriel(fichiers.length)} transmise${pluriel(fichiers.length)} au téléphone.`
    );
  };

  const lancer = async () => {
    setMessage(null);

    if (!surTelephone()) {
      telechargerUnParUn();
      return;
    }

    setEtat("preparation");
    setFaits(0);
    const resultats = await fileDEnvoi(
      medias,
      async (m) => {
        const { nom, url } = cible(m);
        // Cloudinary sert ses images avec « Access-Control-Allow-Origin: * » :
        // le navigateur peut donc les lire directement, sans les faire transiter
        // par notre serveur — ni par le quota de bande passante qui va avec.
        const rep = await fetch(url);
        if (!rep.ok) throw new Error(`Cloudinary a répondu ${rep.status}`);
        const blob = await rep.blob();
        return new File([blob], `${nom}.jpg`, { type: blob.type || "image/jpeg" });
      },
      3,
      (n) => setFaits(n)
    );

    const fichiers = resultats.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!fichiers.length) {
      setEtat("echec");
      setMessage("Aucune photo n'a pu être préparée. Vérifiez la connexion.");
      return;
    }

    try {
      await partager(fichiers);
    } catch (raison) {
      // Partage refermé par l'utilisateur : ce n'est pas une panne, on se tait.
      if (raison instanceof DOMException && raison.name === "AbortError") {
        setEtat("pret");
        return;
      }
      // Safari veut que le partage parte du geste qui l'a demandé. Le temps de
      // charger neuf photos, l'autorisation a expiré. Les fichiers sont en
      // mémoire : un second appui les envoie sans attendre.
      setPrets(fichiers);
      setEtat("aPartager");
      setMessage(null);
    }
  };

  const echecs = etat === "aPartager" ? total - prets.length : 0;

  return (
    <section className="carte p-4">
      <h2 className="text-[17px] font-semibold">Récupérer les photos filigranées</h2>
      <p className="mt-1 text-meta text-dim">
        Les {total} photo{pluriel(total)} de cette moto, en pleine taille et toutes marquées
        « MOTO IMPORT », prêtes à publier sur Facebook.
      </p>

      <div className="mt-3">
        {etat === "aPartager" ? (
          <button type="button" onClick={() => void partager(prets)} className="btn-or w-full">
            Enregistrer les {prets.length} photo{pluriel(prets.length)}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void lancer()}
            disabled={etat === "preparation"}
            className="btn-or w-full disabled:opacity-60"
          >
            {etat === "preparation"
              ? "Préparation…"
              : `Télécharger les ${total} photo${pluriel(total)}`}
          </button>
        )}
      </div>

      {etat === "preparation" ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-hi">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${(faits / Math.max(total, 1)) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 text-meta text-chrome">
            {faits} / {total} — récupération des photos…
          </p>
        </div>
      ) : null}

      {etat === "aPartager" ? (
        <p className="mt-2 text-meta text-chrome">
          {prets.length} photo{pluriel(prets.length)} prête{pluriel(prets.length)}
          {echecs ? ` · ${echecs} n'a pas pu être récupérée` : ""}. Choisissez « Enregistrer les
          images » pour les envoyer dans la pellicule, ou Facebook pour publier directement.
        </p>
      ) : null}

      {message ? (
        <p className={`mt-2 text-meta ${etat === "echec" ? "text-vendu" : "text-chrome"}`}>{message}</p>
      ) : null}
    </section>
  );
}
