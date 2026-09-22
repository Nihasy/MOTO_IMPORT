import type { Metadata } from "next";
import { BarreSuperieure } from "@/components/ui/navigation";
import {
  ACOMPTE_MAX,
  ACOMPTE_MIN,
  DELAI_MAX,
  GARDIENNAGE_AR_JOUR,
  GARDIENNAGE_PLAFOND_JOURS,
  GRACE_LIVRAISON_JOURS,
  INDEMNITE_RESOLUTION_PCT,
  RESOLUTION_JOURS,
  RETRAIT_JOURS,
} from "@/lib/conditions";

// Les CGV écrivent les nombres en toutes lettres, comme un contrat.
const EN_LETTRES: Record<number, string> = {
  10: "dix",
  15: "quinze",
  20: "vingt",
  30: "trente",
  45: "quarante-cinq",
  75: "soixante-quinze",
  80: "quatre-vingts",
};
const enLettres = (n: number) => EN_LETTRES[n] ?? String(n);

// Séparateur de milliers en espace insécable : « 100 000 Ar », jamais « 100,000 ».
const ariary = (n: number) => `${n.toLocaleString("fr-FR").replace(/ /g, " ")} Ar`;
const PLAFOND_GARDIENNAGE = GARDIENNAGE_AR_JOUR * GARDIENNAGE_PLAFOND_JOURS;

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  description: "Conditions générales de vente de MOTO IMPORT : commande, acompte, prix, délais, immatriculation, garantie, livraison, retrait du véhicule.",
  alternates: { canonical: "/cgv" },
  robots: { index: true, follow: true },
};

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
    "4.1 — La commande est formée par la signature d'un bon de commande au local de MOTO IMPORT, à Antananarivo.",
    `4.2 — Pour un véhicule « disponible sur commande », la signature du bon de commande est accompagnée du versement d'un acompte. Son pourcentage, compris entre ${enLettres(ACOMPTE_MIN)} pour cent (${ACOMPTE_MIN} %) et ${enLettres(ACOMPTE_MAX)} pour cent (${ACOMPTE_MAX} %) du prix total, est propre à chaque véhicule. Il est indiqué sur la fiche du véhicule, en pourcentage et en ariary, et repris au bon de commande. Le pourcentage applicable est celui en vigueur à la date de signature.`,
    "4.3 — Le solde du prix est réglé au retrait du véhicule, au local de MOTO IMPORT à Antananarivo, contre remise des clés et du récépissé de dépôt de la demande d'immatriculation. La carte grise suit dans les conditions de l'article 7.",
    "4.4 — Aucune commande n'est engagée par un échange écrit, téléphonique ou électronique préalable.",
  ]],
  ["Article 5 — Prix", [
    "Les prix affichés s'entendent toutes taxes comprises, rendus à Antananarivo, carte grise établie au nom de l'acheteur incluse.",
    "Chaque prix est valable jusqu'à la date indiquée sur la fiche du véhicule.",
    "5.3 — Les prix affichés au catalogue peuvent être modifiés à tout moment avant la signature du bon de commande. Seul le prix inscrit au bon de commande engage les parties.",
    "5.4 — Après signature, le prix est ferme. Une révision ne peut intervenir qu'en cas de variation des droits et taxes d'importation excédant huit pour cent (8 %), auquel cas l'acheteur peut renoncer à la commande et obtenir le remboursement intégral de son acompte.",
  ]],
  ["Article 6 — Annulation et désistement", [
    "6.1 — En cas de désistement de l'acheteur après signature du bon de commande et avant l'arrivée du véhicule à Antananarivo, l'acompte versé reste acquis à MOTO IMPORT, le véhicule ayant été acheté et expédié à sa demande.",
    "6.2 — Le défaut de retrait du véhicule après son arrivée à Antananarivo n'est pas régi par le présent article, mais par l'article 11.",
    "6.3 — En cas d'impossibilité de livrer imputable à MOTO IMPORT, l'acompte est intégralement remboursé.",
  ]],
  ["Article 7 — Immatriculation", [
    "7.1 — MOTO IMPORT prend en charge l'ensemble des démarches d'immatriculation. La carte grise est établie au nom de l'acheteur et son coût est compris dans le prix affiché.",
    "7.2 — La demande d'immatriculation n'est déposée qu'au retrait du véhicule, après règlement intégral du solde. Jusqu'à ce jour, le véhicule n'est immatriculé à aucun nom et demeure la propriété de MOTO IMPORT.",
    "7.3 — L'acheteur reçoit au retrait le récépissé de dépôt de la demande, qui l'autorise à circuler. La carte grise définitive lui est remise dès sa délivrance par l'administration, sans frais supplémentaires.",
  ]],
  ["Article 8 — Garantie", [
    "8.1 — Les véhicules neufs bénéficient de la garantie accordée par la marque et par le concessionnaire d'origine. Sa durée et les organes couverts varient selon le modèle ; ils sont précisés sur la fiche du véhicule et repris au bon de commande.",
    "8.2 — Les véhicules d'occasion sont vendus en l'état, sans garantie. Leur état est décrit sur la fiche du véhicule, points d'usure compris, et documenté par des photographies datées prises sur le véhicule concerné.",
    "8.3 — Sont en tout état de cause exclus les pièces d'usure normale, les dommages résultant d'un défaut d'entretien, d'un usage inadapté ou d'une modification du véhicule.",
  ]],
  ["Article 9 — Délai de livraison", [
    "9.1 — Le délai de livraison court à compter de la signature du bon de commande. Il est celui indiqué sur la fiche du véhicule et repris au bon de commande, et ne peut en aucun cas excéder " +
      `${enLettres(DELAI_MAX)} (${DELAI_MAX}) jours.`,
    "9.2 — Ce délai varie selon la compagnie maritime et la ligne d'acheminement retenues pour le véhicule, dont dépendent la fréquence des départs, le port de transbordement et la durée de la traversée. La fourchette propre à chaque véhicule figure sur sa fiche avant toute signature.",
    "9.3 — Le délai est suspendu pendant la durée de tout événement échappant au contrôle de MOTO IMPORT et affectant l'acheminement maritime ou le dédouanement, notamment la congestion portuaire, la suspension, l'annulation ou le déroutement d'une ligne, le cyclone, la grève et le blocage douanier. MOTO IMPORT en informe l'acheteur et lui communique un nouveau délai prévisionnel.",
    `9.4 — Passé le délai maximum porté au bon de commande, augmenté de ${enLettres(GRACE_LIVRAISON_JOURS)} (${GRACE_LIVRAISON_JOURS}) jours et des suspensions de l'article 9.3, l'acheteur peut annuler sa commande par écrit et obtenir le remboursement intégral de son acompte, sans autre indemnité de part ni d'autre.`,
    "9.5 — La livraison s'entend au local de MOTO IMPORT à Antananarivo. Tout acheminement vers une autre localité fait l'objet d'un accord et d'une facturation distincts.",
  ]],
  ["Article 10 — Mise à disposition", [
    "10.1 — Le véhicule est mis à la disposition de l'acheteur au local de MOTO IMPORT, à Antananarivo, dès son arrivée dédouanée.",
    "10.2 — MOTO IMPORT informe l'acheteur de cette arrivée le jour même, par message adressé au numéro porté au bon de commande et doublé d'un appel. Cette information vaut mise en demeure de retirer le véhicule et de régler le solde.",
    "10.3 — Les délais de l'article 11 courent à compter du jour de l'arrivée du véhicule à Antananarivo, dont la date est celle portée à l'information prévue à l'article 10.2.",
  ]],
  ["Article 11 — Retrait du véhicule et frais de gardiennage", [
    `11.1 — L'acheteur dispose de ${enLettres(RETRAIT_JOURS)} (${RETRAIT_JOURS}) jours à compter de l'arrivée du véhicule à Antananarivo pour régler le solde et retirer le véhicule. Pendant ce délai, aucun frais de garde ne lui est dû.`,
    `11.2 — Passé ce délai, des frais de gardiennage et d'immobilisation de ${ariary(GARDIENNAGE_AR_JOUR)} par jour entamé sont dus, dans la limite de ${enLettres(GARDIENNAGE_PLAFOND_JOURS)} (${GARDIENNAGE_PLAFOND_JOURS}) jours, soit ${ariary(PLAFOND_GARDIENNAGE)} au maximum. Ils couvrent la place occupée, la surveillance et l'entretien de maintien en état du véhicule. Ils sont exigibles en même temps que le solde.`,
    `11.3 — À l'expiration de ce second délai, soit ${enLettres(RESOLUTION_JOURS)} (${RESOLUTION_JOURS}) jours après l'arrivée du véhicule à Antananarivo, la vente est résolue de plein droit, sans autre mise en demeure que l'information de l'article 10.2. Le véhicule, qui n'a été immatriculé à aucun nom en application de l'article 7.2, redevient librement disponible à la vente.`,
    `11.4 — En ce cas, MOTO IMPORT conserve à titre d'indemnité forfaitaire les frais de gardiennage échus ainsi qu'une somme égale à ${enLettres(INDEMNITE_RESOLUTION_PCT)} pour cent (${INDEMNITE_RESOLUTION_PCT} %) du prix porté au bon de commande. Le surplus de l'acompte est restitué à l'acheteur dans les ${enLettres(30)} (30) jours de la revente effective du véhicule.`,
    `11.5 — L'acheteur peut, avant l'expiration du délai de l'article 11.1, solliciter par écrit une prorogation. Elle n'est acquise qu'autant que MOTO IMPORT l'accepte par écrit ; elle suspend alors les frais de l'article 11.2 pour la durée convenue.`,
  ]],
  ["Article 12 — Transfert des risques", [
    "12.1 — Le véhicule demeure sous la garde et aux risques de MOTO IMPORT jusqu'à l'expiration du délai de retrait de l'article 11.1.",
    "12.2 — Au-delà de ce terme, le véhicule est conservé aux risques de l'acheteur. Les frais de l'article 11.2 rémunèrent une garde matérielle et ne valent pas assurance.",
    "12.3 — La propriété du véhicule n'est transférée à l'acheteur qu'au paiement intégral du prix.",
  ]],
  ["Article 13 — Droit applicable", [
    "Les présentes conditions sont soumises au droit malgache. Tout litige relève de la compétence des tribunaux d'Antananarivo.",
  ]],
];

export default function Page() {
  return (
    <>
      <BarreSuperieure titre="CGV" />
      <main className="conteneur pb-24 pt-6">
        <h1 className="text-titre-fiche">Conditions générales de vente</h1>
        <p className="mt-2 text-meta text-dim">Version en vigueur au 22 septembre 2026 — MOTO IMPORT, Antananarivo.</p>
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
