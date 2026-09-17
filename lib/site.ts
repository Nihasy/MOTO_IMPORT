/**
 * Adresse publique du site, sans barre oblique finale.
 *
 * Le repli couvre le vide autant que l'absence. Une variable déclarée mais
 * laissée vide — le cas d'un environnement préparé avant d'avoir l'adresse —
 * traversait un simple `??` et faisait échouer la construction entière sur
 * `new URL("")`, depuis `metadataBase`. L'erreur, « Invalid URL » au moment de
 * collecter les données de `/_not-found`, ne nommait ni la variable ni le
 * fichier : elle coûte plus cher à diagnostiquer qu'à prévenir.
 *
 * Une valeur illisible retombe de même sur l'adresse locale : mieux vaut des
 * liens canoniques faux, visibles à la première relecture, qu'un déploiement
 * qui n'aboutit pas.
 */
function lireUrlSite(): string {
  const brut = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!brut) return "http://localhost:3000";
  try {
    // `origin` normalise : ni barre finale, ni chemin, ni paramètres.
    return new URL(brut).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export const SITE_URL = lireUrlSite();
