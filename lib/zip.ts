/**
 * Archive ZIP minimale, sans compression (méthode « stockée »).
 *
 * Elle sert au kit du Studio Facebook : des PNG, déjà compressés, et un fichier
 * texte de quelques lignes. Une bibliothèque entière pour gagner quelques
 * kilo-octets sur la légende ne se justifie pas.
 */

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type FichierZip = { nom: string; contenu: Uint8Array | string };

/**
 * Les noms sont écrits en UTF-8 avec le drapeau 11 levé : sans lui, Windows
 * relit « légende.txt » en CP437 et affiche des caractères cassés.
 */
export function creerZip(fichiers: FichierZip[]): Uint8Array {
  const enc = new TextEncoder();
  const locaux: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let decalage = 0;

  for (const f of fichiers) {
    const nom = enc.encode(f.nom);
    const donnees = typeof f.contenu === "string" ? enc.encode(f.contenu) : f.contenu;
    const crc = crc32(donnees);

    const entete = new Uint8Array(30 + nom.length);
    const v = new DataView(entete.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true);
    v.setUint16(8, 0, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, donnees.length, true);
    v.setUint32(22, donnees.length, true);
    v.setUint16(26, nom.length, true);
    entete.set(nom, 30);

    const c = new Uint8Array(46 + nom.length);
    const w = new DataView(c.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x0800, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, donnees.length, true);
    w.setUint32(24, donnees.length, true);
    w.setUint16(28, nom.length, true);
    w.setUint32(42, decalage, true);
    c.set(nom, 46);

    locaux.push(entete, donnees);
    central.push(c);
    decalage += entete.length + donnees.length;
  }

  const tailleCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, fichiers.length, true);
  f.setUint16(10, fichiers.length, true);
  f.setUint32(12, tailleCentral, true);
  f.setUint32(16, decalage, true);

  const total = decalage + tailleCentral + fin.length;
  const sortie = new Uint8Array(total);
  let i = 0;
  for (const morceau of [...locaux, ...central, fin]) {
    sortie.set(morceau, i);
    i += morceau.length;
  }
  return sortie;
}
