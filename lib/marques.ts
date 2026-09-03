/**
 * Marques proposées au filtre, au-delà de celles déjà présentes au catalogue.
 * Un acheteur cherche souvent une marque que nous n'avons pas encore en stock :
 * la lui montrer, quitte à ne rien renvoyer, vaut mieux que de faire comme si
 * elle n'existait pas — et la recherche vide devient une demande sur mesure.
 *
 * Les constructeurs chinois figurent en bonne place : ce sont nos ateliers
 * partenaires, et l'essentiel des importations.
 */
export const MARQUES_CONNUES = [
  // Japon
  "Honda",
  "Yamaha",
  "Suzuki",
  "Kawasaki",
  // Chine — sourcing principal
  "CFMoto",
  "QJ Motor",
  "Voge",
  "Zontes",
  "Kove",
  "Loncin",
  "Lifan",
  "Zongshen",
  "Haojue",
  "Jialing",
  "Jianshe",
  "Shineray",
  "Bashan",
  "Colove",
  "Keeway",
  "Znen",
  "Sanya",
  "Wuyang",
  "Dayun",
  "Kayo",
  "Segway Powersports",
  // Taïwan
  "Kymco",
  "SYM",
  // Inde
  "Bajaj",
  "TVS",
  "Hero",
  "Royal Enfield",
  "Mahindra",
  // Europe
  "BMW",
  "Ducati",
  "KTM",
  "Triumph",
  "Aprilia",
  "Moto Guzzi",
  "MV Agusta",
  "Husqvarna",
  "Benelli",
  "Piaggio",
  "Vespa",
  "Peugeot",
  "Derbi",
  "Gilera",
  "Beta",
  "GasGas",
  "Sherco",
  "Fantic",
  "Rieju",
  "Mash",
  "Brixton",
  "Norton",
  "Cagiva",
  "Husaberg",
  "Ossa",
  "Bultaco",
  // Amérique du Nord
  "Harley-Davidson",
  "Indian",
  "Buell",
  "Polaris",
  // Corée
  "Daelim",
  "Hyosung",
  // Électrique
  "Zero",
  "Energica",
  "Super Soco",
  "Niu",
] as const;

/**
 * Fusionne les marques du catalogue et la liste de référence. Celles qui ont
 * du stock passent devant, effectif décroissant ; les autres suivent par ordre
 * alphabétique.
 */
export function fusionnerMarques(
  duCatalogue: { nom: string; effectif: number }[]
): { nom: string; effectif: number }[] {
  const vues = new Map(duCatalogue.map((m) => [m.nom.toLowerCase(), m]));
  const autres = MARQUES_CONNUES.filter((n) => !vues.has(n.toLowerCase()))
    .map((nom) => ({ nom, effectif: 0 }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const avecStock = [...duCatalogue].sort(
    (a, b) => b.effectif - a.effectif || a.nom.localeCompare(b.nom, "fr")
  );
  return [...avecStock, ...autres];
}
