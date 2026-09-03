/**
 * Serialisation sure de donnees structurees inserees dans un <script>.
 *
 * `JSON.stringify` n'echappe ni `<` ni `>` : une description contenant
 * `</script><script>...` refermerait la balise et executerait du code sur
 * une page publique. Les champs viennent du back-office, mais un contenu
 * saisi par un editeur ne doit jamais pouvoir devenir du script.
 *
 * U+2028 et U+2029 sont des sauts de ligne valides en JavaScript mais pas
 * en JSON : non echappes, ils cassent le script qui les contient.
 */
export function jsonLdSecurise(donnees: unknown): string {
  return JSON.stringify(donnees)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
