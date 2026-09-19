"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { Fournisseur, Moto } from "@/lib/types";
import { CATEGORIES, ETATS, LIBELLE_CATEGORIE } from "@/lib/types";
import { compterMots } from "@/lib/format";
import { enregistrerMoto, type EtatFormulaire } from "@/app/admin/actions";
import type { Reglages } from "@/lib/tarification";
import { BlocPrixAchat } from "@/components/admin/bloc-prix-achat";
import { ChampMontant } from "@/components/admin/champ-montant";

function Bouton({ creation }: { creation: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-or w-full" disabled={pending}>
      {pending ? "Enregistrement…" : creation ? "Créer la fiche en brouillon" : "Enregistrer les modifications"}
    </button>
  );
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const dansSixMois = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
};

/**
 * Formulaire en une colonne, utilisable au pouce depuis un téléphone.
 * Objectif de recette : publier une moto en moins de cinq minutes (7.6).
 */
export function FormulaireMoto({
  moto,
  fournisseurs,
  referenceSuggeree,
  reglages,
}: {
  moto?: Moto;
  fournisseurs: Fournisseur[];
  referenceSuggeree?: string;
  /** Réglages de tarification : transmis au seul compte administrateur. */
  reglages: Reglages | null;
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(enregistrerMoto, null);
  const [estOccasion, setEstOccasion] = useState(moto?.etat === "occasion");
  const [description, setDescription] = useState(moto?.description ?? "");

  const mots = compterMots(description);
  const champEnErreur = (nom: string) => (etat?.champ === nom ? "border-vendu" : "");

  /**
   * Valeur d'un champ après un refus.
   *
   * React vide le formulaire à chaque soumission par action : sans la saisie
   * renvoyée par le serveur, un refus effacerait toute la fiche. La clé du
   * `form` change à chaque tentative pour que les champs se remontent sur ces
   * valeurs plutôt que sur le formulaire vide que React vient de rétablir.
   */
  const repris = etat?.valeurs;
  const val = (nom: string, defaut: string | number | null | undefined) =>
    repris?.[nom] ?? defaut ?? "";

  return (
    <form action={action} key={etat?.tentative ?? 0} className="max-w-xl space-y-4">
      {moto ? <input type="hidden" name="id" value={moto.id} /> : null}

      {etat?.erreur ? (
        <p role="alert" className="rounded-card border border-vendu/50 bg-vendu/10 px-3 py-2.5 text-corps text-vendu">
          {etat.erreur}
          {etat.champ ? <span className="block text-meta opacity-80">Champ : {etat.champ}</span> : null}
        </p>
      ) : null}

      <fieldset className="carte space-y-3 p-4">
        <legend className="px-1 text-[12.5px] font-semibold text-gold-light">Identification</legend>

        <div>
          <label className="etiquette" htmlFor="reference">Référence *</label>
          <input
            id="reference" name="reference" required placeholder="MI-047"
            defaultValue={val("reference", moto?.reference ?? referenceSuggeree)}
            className={`champ ${champEnErreur("reference")}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiquette" htmlFor="marque">Marque *</label>
            <input id="marque" name="marque" required defaultValue={val("marque", moto?.marque)} className={`champ ${champEnErreur("marque")}`} />
          </div>
          <div>
            <label className="etiquette" htmlFor="modele">Modèle *</label>
            <input id="modele" name="modele" required defaultValue={val("modele", moto?.modele)} className={`champ ${champEnErreur("modele")}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiquette" htmlFor="annee">Année *</label>
            <input id="annee" name="annee" type="number" inputMode="numeric" required min={1990} max={2100}
              defaultValue={val("annee", moto?.annee ?? new Date().getFullYear())} className={`champ ${champEnErreur("annee")}`} />
          </div>
          <div>
            <label className="etiquette" htmlFor="cylindree">Cylindrée (cm³) *</label>
            <input id="cylindree" name="cylindree" type="number" inputMode="numeric" required min={1}
              defaultValue={val("cylindree", moto?.cylindree)} className={`champ ${champEnErreur("cylindree")}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiquette" htmlFor="categorie">Catégorie *</label>
            <select id="categorie" name="categorie" defaultValue={val("categorie", moto?.categorie ?? "trail")} className="champ">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{LIBELLE_CATEGORIE[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiquette" htmlFor="etat">État *</label>
            <select id="etat" name="etat" defaultValue={val("etat", moto?.etat ?? "neuf")} className="champ"
              onChange={(e) => setEstOccasion(e.target.value === "occasion")}>
              {ETATS.map((e) => (
                <option key={e} value={e}>{e === "neuf" ? "Neuf" : "Occasion"}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Le statut ne se règle pas ici. Une fiche neuve n'a aucune photo :
            proposer « Disponible » revenait à faire choisir un statut que le
            verrou de publication refuse toujours, en perdant la saisie. Il a
            son propre sélecteur, en haut de la fiche et dans la liste, qui
            affiche ce qui manque sans rien faire perdre. */}
        {moto ? null : (
          <p className="rounded-card border border-line bg-surface-hi px-3 py-2.5 text-meta text-chrome">
            <strong className="font-semibold text-text">La fiche naît en brouillon</strong>, invisible
            du public. Vous ajouterez les photos à l&apos;étape suivante, puis vous la mettrez en vente
            depuis le sélecteur de statut quand les contrôles seront au vert.
          </p>
        )}

        {moto?.statut === "vendu" ? (
          <div>
            <label className="etiquette" htmlFor="date_vente">Date de vente *</label>
            <input id="date_vente" name="date_vente" type="date" defaultValue={val("date_vente", moto?.date_vente ?? aujourdhui())}
              className={`champ ${champEnErreur("date_vente")}`} />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="carte space-y-3 p-4">
        <legend className="px-1 text-[12.5px] font-semibold text-gold-light">Prix et engagement</legend>

        <BlocPrixAchat
          moto={moto}
          reglages={reglages}
          valeurReprise={repris?.prix_yuan}
          enErreur={etat?.champ === "prix_yuan"}
        />

        <div>
          <label className="etiquette" htmlFor="prix_valable_jusqu_au">Prix valable jusqu&apos;au *</label>
          <input id="prix_valable_jusqu_au" name="prix_valable_jusqu_au" type="date" required
            defaultValue={val("prix_valable_jusqu_au", moto?.prix_valable_jusqu_au ?? dansSixMois())}
            className={`champ ${champEnErreur("prix_valable_jusqu_au")}`} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiquette" htmlFor="delai_min_jours">Délai min. (jours)</label>
            <input id="delai_min_jours" name="delai_min_jours" type="number" inputMode="numeric"
              defaultValue={val("delai_min_jours", moto?.delai_min_jours ?? 45)} className="champ" />
          </div>
          <div>
            <label className="etiquette" htmlFor="delai_max_jours">Délai max. (jours)</label>
            <input id="delai_max_jours" name="delai_max_jours" type="number" inputMode="numeric"
              defaultValue={val("delai_max_jours", moto?.delai_max_jours ?? 65)} className={`champ ${champEnErreur("delai_max_jours")}`} />
          </div>
        </div>

        {/* SAV : seul le neuf est garanti, selon la marque et le concessionnaire
            d'origine. Pour une occasion les champs disparaissent et sont forcés
            à vide — les laisser saisissables invite à promettre un SAV qui
            n'existe pas, et la base les refuserait de toute façon. */}
        {estOccasion ? (
          <>
            <input type="hidden" name="garantie_mois" value="0" />
            <input type="hidden" name="garantie_texte" value="" />
            <p className="rounded-card border border-line bg-surface-hi px-3 py-2.5 text-meta text-chrome">
              <strong className="font-semibold text-text">Occasion : vendue sans garantie.</strong>{" "}
              Seuls les véhicules neufs sont couverts, dans les termes fixés par la marque et le
              concessionnaire. La fiche l&apos;annonce au visiteur et renvoie au bloc « État du
              véhicule ».
            </p>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiquette" htmlFor="garantie_mois">
                Garantie (mois) <span className="text-dim">— pour publier</span>
              </label>
              <input id="garantie_mois" name="garantie_mois" type="number" inputMode="numeric" min={0}
                defaultValue={val("garantie_mois", moto?.garantie_mois ?? 0)} className={`champ ${champEnErreur("garantie_mois")}`} />
            </div>
            <div>
              <label className="etiquette" htmlFor="garantie_texte">
                Organes couverts <span className="text-dim">— pour publier</span>
              </label>
              <input id="garantie_texte" name="garantie_texte" placeholder="Moteur et boîte"
                defaultValue={val("garantie_texte", moto?.garantie_texte)} className={`champ ${champEnErreur("garantie_texte")}`} />
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="carte space-y-3 p-4">
        <legend className="px-1 text-[12.5px] font-semibold text-gold-light">Caractéristiques</legend>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiquette" htmlFor="kilometrage">
              Kilométrage {estOccasion ? "*" : "(occasion)"}
            </label>
            <ChampMontant id="kilometrage" name="kilometrage" required={estOccasion} suffixe="km"
              defaultValue={val("kilometrage", moto?.kilometrage)} className={champEnErreur("kilometrage")} />
          </div>
          <div>
            <label className="etiquette" htmlFor="couleur">Couleur</label>
            <input id="couleur" name="couleur" defaultValue={val("couleur", moto?.couleur)} className="champ" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiquette" htmlFor="puissance_ch">Puissance (ch)</label>
            <input id="puissance_ch" name="puissance_ch" type="number" inputMode="numeric"
              defaultValue={val("puissance_ch", moto?.puissance_ch)} className="champ" />
          </div>
          <div>
            <label className="etiquette" htmlFor="poids_kg">Poids (kg)</label>
            <input id="poids_kg" name="poids_kg" type="number" inputMode="numeric"
              defaultValue={val("poids_kg", moto?.poids_kg)} className="champ" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiquette" htmlFor="hauteur_selle_mm">Hauteur de selle (mm)</label>
            <input id="hauteur_selle_mm" name="hauteur_selle_mm" type="number" inputMode="numeric"
              defaultValue={val("hauteur_selle_mm", moto?.hauteur_selle_mm)} className="champ" />
          </div>
          <div>
            <label className="etiquette" htmlFor="refroidissement">Refroidissement</label>
            <select id="refroidissement" name="refroidissement" defaultValue={val("refroidissement", moto?.refroidissement)} className="champ">
              <option value="">—</option>
              <option value="air">Air</option>
              <option value="liquide">Liquide</option>
            </select>
          </div>
        </div>

        <div>
          <label className="etiquette" htmlFor="transmission">Transmission</label>
          <input id="transmission" name="transmission" placeholder="6 rapports" defaultValue={val("transmission", moto?.transmission)} className="champ" />
        </div>

        <label className="flex min-h-touch items-center gap-3">
          <input type="checkbox" name="abs" defaultChecked={repris ? repris.abs === "on" : (moto?.abs ?? false)} className="h-5 w-5 accent-gold" />
          <span className="text-corps">ABS</span>
        </label>
      </fieldset>

      <fieldset className="carte space-y-3 p-4">
        <legend className="px-1 text-[12.5px] font-semibold text-gold-light">Contenu</legend>

        <div>
          <label className="etiquette" htmlFor="description">
            Description rédigée — <span className={mots >= 1 ? "text-dispo" : "text-dim"}>{mots} mot{mots > 1 ? "s" : ""}</span>{" "}
            <span className="text-dim">(facultative ici, requise pour publier)</span>
          </label>
          <textarea id="description" name="description" rows={9} value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Écrivez votre propre texte. Jamais une traduction automatique du fournisseur : cela se repère immédiatement."
            className={`champ py-2.5 ${champEnErreur("description")}`} />
        </div>

        <div>
          <label className="etiquette" htmlFor="points_forts">Points forts (séparés par |)</label>
          <input id="points_forts" name="points_forts" placeholder="ABS de série|Selle basse|Faible consommation"
            defaultValue={val("points_forts", moto?.points_forts.join(" | "))} className="champ" />
        </div>

        {estOccasion ? (
          <>
            <div>
              <label className="etiquette" htmlFor="points_usure">Points d&apos;usure (séparés par |)</label>
              <input id="points_usure" name="points_usure" placeholder="Rayure sur le carénage droit|Pneu arrière à 40 %"
                defaultValue={val("points_usure", moto?.etat_details?.points_usure?.join(" | "))} className="champ" />
            </div>
            <div>
              <label className="etiquette" htmlFor="date_photos">Date de prise de vue * (CGV art. 3.4)</label>
              <input id="date_photos" name="date_photos" type="date" defaultValue={val("date_photos", moto?.date_photos ?? aujourdhui())}
                className={`champ ${champEnErreur("date_photos")}`} />
            </div>
          </>
        ) : null}

        <div>
          <label className="etiquette" htmlFor="fournisseur_id">
            Fournisseur <span className="text-dim">— interne, jamais exposé au public</span>
          </label>
          <select id="fournisseur_id" name="fournisseur_id" defaultValue={val("fournisseur_id", moto?.fournisseur_id)} className="champ">
            <option value="">—</option>
            {fournisseurs.map((f) => (
              <option key={f.id} value={f.id}>{f.nom}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <Bouton creation={!moto} />
        <Link href="/admin/motos" className="mt-2 block text-center text-[12.5px] text-dim">
          Annuler
        </Link>
      </div>
    </form>
  );
}
