import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ar, dateFr } from "@/lib/format";
import { messageDevis } from "@/lib/whatsapp";
import { FormulaireMoto } from "@/components/admin/formulaire-moto";
import { GrillePhotos } from "@/components/admin/grille-photos";
import { ListeControles, controlesPublication } from "@/components/admin/controles-publication";
import { AjoutPhotos } from "@/components/admin/ajout-photos";
import { BoutonDanger } from "@/components/admin/bouton-danger";
import { BarreFiltres, EntetePage, PuceFiltre } from "@/components/admin/ui";
import { BadgeStatut } from "@/components/ui";
import { estPublic } from "@/lib/types";
import { vuesManquantes } from "@/lib/medias";
import { supprimerMoto } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
};

const ONGLETS = [
  { cle: "infos", libelle: "Informations" },
  { cle: "photos", libelle: "Photos" },
  { cle: "apercu", libelle: "Aperçu public" },
];

export default async function EditionMoto({ params, searchParams }: Props) {
  const { id } = await params;
  const { onglet = "infos" } = await searchParams;

  const pilote = db();
  const moto = await pilote.motoParId(id);
  if (!moto) notFound();

  const [medias, fournisseurs] = await Promise.all([
    pilote.mediasDeMoto(id),
    pilote.listerFournisseurs(),
  ]);
  const controles = controlesPublication(moto, medias);
  const bloquants = controles.filter((c) => !c.ok).length;

  return (
    <div>
      <EntetePage
        titre={`${moto.reference} · ${moto.marque} ${moto.modele}`}
        sousTitre={
          bloquants
            ? `${bloquants} point${bloquants > 1 ? "s" : ""} à corriger avant de pouvoir mettre cette fiche en vente.`
            : "Tous les contrôles sont au vert : cette fiche peut passer en vente."
        }
      >
        <BadgeStatut statut={moto.statut} />
        {estPublic(moto.statut) ? (
          <Link
            href={`/motos/${moto.slug}`}
            target="_blank"
            rel="noopener"
            className="btn-fantome px-3 text-[12px]"
          >
            Fiche publique ↗
          </Link>
        ) : (
          <span className="text-[12px] text-dim">Non visible du public</span>
        )}
      </EntetePage>

      <BarreFiltres legende="Section">
        {ONGLETS.map((o) => (
          <PuceFiltre
            key={o.cle}
            href={`/admin/motos/${id}?onglet=${o.cle}`}
            actif={onglet === o.cle}
          >
            {o.libelle}
            {o.cle === "photos" && bloquants ? (
              <span className="ml-1.5 inline-flex min-w-[18px] justify-center rounded-full bg-vendu px-1.5 text-[10.5px] font-bold leading-[16px] text-white">
                {bloquants}
              </span>
            ) : null}
          </PuceFiltre>
        ))}
      </BarreFiltres>

      {onglet === "infos" ? (
        <>
          <FormulaireMoto moto={moto} fournisseurs={fournisseurs} />
          <div className="mt-6 max-w-xl">
            <BoutonDanger
              action={supprimerMoto}
              champsCaches={{ id: moto.id }}
              libelle="Supprimer définitivement cette moto"
              motDePasse={moto.reference}
              avertissement={
                "Préférez le statut « Archivé ». Une fiche supprimée produit des 404 sur vos liens " +
                "Facebook, détruit le référencement acquis, et emporte ses photos et ses demandes rattachées."
              }
            />
          </div>
        </>
      ) : null}

      {onglet === "photos" ? (
        <div className="space-y-5">
          <ListeControles controles={controles} />
          <AjoutPhotos
            moto={moto}
            nbExistantes={medias.length}
            manquantes={vuesManquantes(medias, moto.etat)}
          />
          <GrillePhotos motoId={moto.id} medias={medias} />
        </div>
      ) : null}

      {onglet === "apercu" ? (
        <div className="max-w-xl space-y-4">
          <ListeControles controles={controles} />
          <section className="carte p-4">
            <h2 className="text-[17px] font-semibold">Ce que verra le visiteur</h2>
            <p className="mt-3 text-prix-fiche leading-none text-gold-light">
              {ar(moto.prix_ttc)}
            </p>
            <p className="mt-1.5 text-corps text-chrome">
              Prix final, rendu à Antananarivo. Carte grise établie à votre nom, incluse.
            </p>
            <p className="mt-1 text-meta text-dim">
              Valable jusqu&apos;au {dateFr(moto.prix_valable_jusqu_au)} · livraison{" "}
              {moto.delai_min_jours} à {moto.delai_max_jours} jours
            </p>
          </section>

          <section className="carte p-4">
            <h2 className="text-[17px] font-semibold">Message WhatsApp généré</h2>
            <p className="mt-2 rounded-card bg-surface-hi p-3 text-corps text-chrome">
              {messageDevis(moto)}
            </p>
          </section>

          <section className="carte p-4">
            <h2 className="text-[17px] font-semibold">Adresse publique</h2>
            <p className="mt-2 break-all text-corps text-chrome">/motos/{moto.slug}</p>
            <p className="mt-1 text-meta text-dim">
              {moto.vues} vue{moto.vues > 1 ? "s" : ""} · créée le {dateFr(moto.created_at)}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
