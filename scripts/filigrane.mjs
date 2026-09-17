/**
 * Fabrique `public/filigrane.png` — la marque posée sur les photos.
 *
 * Le logo livré est un JPEG carré sur fond noir texturé : posé tel quel sur
 * une photo, il y collerait un rectangle sombre. On le détoure donc en cercle,
 * et on lui adjoint la signature « MOTO IMPORT » à plat. Le médaillon seul
 * devient un anneau doré illisible une fois réduit à 200 px sur une carte de
 * catalogue ; c'est le lettrage, pas le dessin, qui dissuade la reprise.
 *
 * Le fichier produit est versionné : il n'est refabriqué que si le logo
 * change. `npm run filigrane`.
 */
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const RACINE = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(RACINE, "public", "logo.jpeg");
const SORTIE = path.join(RACINE, "public", "filigrane.png");

/** Hauteur de référence de la marque. Elle est redimensionnée à l'affichage. */
const COTE = 240;
const ECART = 30;

/** Détourage circulaire, très légèrement rentré pour manger le liseré noir. */
async function medaillon() {
  const disque = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COTE}" height="${COTE}">
       <circle cx="${COTE / 2}" cy="${COTE / 2}" r="${COTE / 2 - 2}" fill="#fff"/>
     </svg>`
  );
  return sharp(SOURCE)
    .resize(COTE, COTE, { fit: "cover" })
    .composite([{ input: disque, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * Signature. Elle est tracée deux fois : un contour sombre en dessous, le
 * lettrage au-dessus. Sans ce contour, la marque disparaît sur un réservoir
 * blanc ou un ciel surexposé — exactement les photos qu'on cherche à protéger.
 */
async function signature() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${COTE}">
    <g font-family="Barlow, Arial, Helvetica, sans-serif" font-size="96" font-weight="bold"
       letter-spacing="4" text-anchor="end">
      <text x="1060" y="126" fill="none" stroke="#000000" stroke-opacity="0.55"
            stroke-width="12" stroke-linejoin="round">MOTO<tspan dx="26">IMPORT</tspan></text>
      <text x="1060" y="126" fill="#F2F5F7">MOTO<tspan dx="26" fill="#E7C983">IMPORT</tspan></text>
    </g>
  </svg>`;
  // `trim` ramène le bloc à ses pixels utiles : la largeur réelle du lettrage
  // dépend des métriques de la police installée, pas d'une estimation.
  return sharp(Buffer.from(svg)).png().trim({ threshold: 1 }).toBuffer();
}

const [disque, texte] = await Promise.all([medaillon(), signature()]);
const { width: largeurTexte = 0, height: hauteurTexte = 0 } = await sharp(texte).metadata();

const largeur = largeurTexte + ECART + COTE;

await mkdir(path.dirname(SORTIE), { recursive: true });
await sharp({
  create: { width: largeur, height: COTE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([
    { input: texte, left: 0, top: Math.round((COTE - hauteurTexte) / 2) },
    { input: disque, left: largeurTexte + ECART, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(SORTIE);

console.log(`filigrane.png — ${largeur}x${COTE}`);
