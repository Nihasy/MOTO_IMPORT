import type { Metadata } from "next";
import { BarreSuperieure } from "@/components/ui/navigation";
import { ACOMPTE_COMMANDE, SOLDE_LIVRAISON } from "@/lib/conditions";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Conditions générales de vente de MOTO IMPORT : commande, acompte, prix, délais, immatriculation, garantie, livraison.",
  alternates: { canonical: "/cgv" },
  robots: { index: true, follow: true },
};

// Les CGV écrivent le pourcentage en toutes lettres, comme un contrat.
const EN_LETTRES: Record<number, string> = {
  20: "vingt", 25: "vingt-cinq", 30: "trente", 35: "trente-cinq", 40: "quarante", 45: "quarante-cinq",
  50: "cinquante", 55: "cinquante-cinq", 60: "soixante", 65: "soixante-cinq", 70: "soixante-dix",
  75: "soixante-quinze", 80: "quatre-vingts",
};
const enLettres = (n: number) => EN_LETTRES[n] ?? String(n);

const ARTICLES: [string, string[]][] = [
  ["Article 1 — Objet", [
    "Les présentes conditions régissent la vente de motocycles importés par MOTO IMPORT, établie à Antananarivo, à tout acheteur signataire d'un bon de commande.",
    "Toute commande implique l'acceptation sans réserve des présentes conditions.",
  ]],
  ["Article 2 — Absence de stock", [
    "MOTO IMPORT ne détient aucun stock de véhicules. Chaque motocycle est commandé auprès d'un atelier partenaire après signature du bon de commande par l'acheteur.",
    "La mention « disponible sur commande » figurant au catalogue signifie que le véhicule est sourçable auprès d'un partenaire, et non qu'il est physiquement présent à Antananarivo.",
  ]],
  ["Article 3 — Description des véhicules", [
    "Les caractéristiques techniques figurant sur chaque fiche sont communiquées par l'atelier partenaire et vérifiées par MOTO IMPORT.",
    "3.4 — Les véhicules d'occasion font l'objet de photographies datées prises sur le véhicule réel, mentionnant le kilométrage relevé au compteur ainsi que les points d'usure constatés. La date de prise de vue figure obligatoirement sur la fiche.",
  ]],
  ["Article 4 — Commande et acompte", [
    "La commande est formée par la signature d'un bon de commande au local de MOTO IMPORT.",
    `Pour un véhicule « disponible sur commande », la signature du bon de commande est accompagnée du versement d'un acompte de ${enLettres(ACOMPTE_COMMANDE)} pour cent (${ACOMPTE_COMMANDE} %) du prix total. Le solde, soit ${enLettres(SOLDE_LIVRAISON)} pour cent (${SOLDE_LIVRAISON} %), est réglé à la remise des clés et des papiers du véhicule, au local d'Antananarivo.`,
    "Aucune commande n'est engagée par un échange écrit, téléphonique ou électronique préalable.",
  ]],
  ["Article 5 — Prix", [
    "Les prix affichés s'entendent toutes taxes comprises, rendus à Antananarivo, carte grise établie au nom de l'acheteur incluse.",
    "Chaque prix est valable jusqu'à la date indiquée sur la fiche du véhicule.",
    "5.4 — Après signature, le prix est ferme. Une révision ne peut intervenir qu'en cas de variation des droits et taxes d'importation excédant huit pour cent (8 %), auquel cas l'acheteur peut renoncer à la commande et obtenir le remboursement intégral de son acompte.",
  ]],
  ["Article 6 — Annulation et désistement", [
    "En cas de désistement de l'acheteur après signature du bon de commande, l'acompte versé reste acquis à MOTO IMPORT, le véhicule ayant été acheté et expédié à sa demande.",
    "En cas d'impossibilité de livrer imputable à MOTO IMPORT, l'acompte est intégralement remboursé.",
  ]],
  ["Article 7 — Immatriculation", [
    "MOTO IMPORT prend en charge l'ensemble des démarches d'immatriculation. La carte grise est établie au nom de l'acheteur et son coût est compris dans le prix affiché.",
  ]],
  ["Article 8 — Garantie", [
    "8.1 — Les véhicules neufs bénéficient de la garantie accordée par la marque et par le concessionnaire d'origine. Sa durée et les organes couverts varient selon le modèle ; ils sont précisés sur la fiche du véhicule et repris au bon de commande.",
    "8.2 — Les véhicules d'occasion sont vendus en l'état, sans garantie. Leur état est décrit sur la fiche du véhicule, points d'usure compris, et documenté par des photographies datées prises sur le véhicule concerné.",
    "8.3 — Sont en tout état de cause exclus les pièces d'usure normale, les dommages résultant d'un défaut d'entretien, d'un usage inadapté ou d'une modification du véhicule.",
  ]],
  ["Article 9 — Livraison", [
    "Le délai de livraison est de quarante-cinq (45) à soixante-cinq (65) jours à compter de la signature du bon de commande.",
    "La livraison s'entend au local de MOTO IMPORT à Antananarivo. Tout acheminement vers une autre localité fait l'objet d'un accord et d'une facturation distincts.",
    "Le solde du prix est exigible à la remise des clés et des papiers du véhicule.",
  ]],
  ["Article 10 — Droit applicable", [
    "Les présentes conditions sont soumises au droit malgache. Tout litige relève de la compétence des tribunaux d'Antananarivo.",
  ]],
];

export default function Page() {
  return (
    <>
      <BarreSuperieure titre="CGV" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">Conditions générales de vente</h1>
        <p className="mt-2 text-meta text-dim">Version en vigueur au 19 septembre 2026 — MOTO IMPORT, Antananarivo.</p>
        <div className="mt-5 space-y-5">
          {ARTICLES.map(([titre, paragraphes]) => (
            <section key={titre}>
              <h2 className="text-[15px] font-semibold text-gold-light">{titre}</h2>
              {paragraphes.map((p, i) => (
                <p key={i} className="mt-1.5 text-corps leading-relaxed text-chrome">{p}</p>
              ))}
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
