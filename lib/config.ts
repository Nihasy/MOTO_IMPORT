/**
 * Validation de la configuration sensible.
 *
 * Principe : en développement, des valeurs de repli permettent de démarrer
 * sans rien configurer. En production, ces replis sont refusés — un secret
 * codé en dur dans un dépôt n'est pas un secret, et un back-office protégé
 * par des identifiants publiés dans le code n'est pas protégé.
 */

export const enProduction = () => process.env.NODE_ENV === "production";

export class ConfigurationManquante extends Error {
  constructor(variable: string, role: string) {
    super(
      `${variable} n'est pas définie. ${role} ` +
        `Générez-la avec : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
    this.name = "ConfigurationManquante";
  }
}

const SECRET_DEV = "developpement-uniquement-ne-jamais-utiliser-en-production";

/** Secret de signature des sessions du back-office. */
export function secretSession(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (enProduction()) {
    throw new ConfigurationManquante(
      "AUTH_SECRET",
      "Sans elle, les sessions du back-office seraient signées avec un secret connu de tous, et n'importe qui pourrait se forger un accès administrateur."
    );
  }
  return SECRET_DEV;
}

/** Sel de hachage des adresses IP. */
export function selIp(): string {
  const s = process.env.IP_SALT ?? process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  if (enProduction()) {
    throw new ConfigurationManquante(
      "IP_SALT",
      "Sans elle, les empreintes d'adresses IP seraient calculées avec un sel public et redeviendraient identifiantes."
    );
  }
  return SECRET_DEV;
}

/**
 * Diagnostic de configuration, affiché au démarrage et dans le back-office.
 * Ne renvoie jamais la valeur des secrets, seulement leur présence.
 */
export function diagnosticConfiguration(): { bloquants: string[]; avertissements: string[] } {
  const bloquants: string[] = [];
  const avertissements: string[] = [];

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
    (enProduction() ? bloquants : avertissements).push(
      "AUTH_SECRET absente ou trop courte (32 octets attendus)"
    );
  }
  if (!process.env.ADMIN_ACCOUNTS) {
    (enProduction() ? bloquants : avertissements).push(
      "ADMIN_ACCOUNTS absente : aucun compte back-office ne peut se connecter en production"
    );
  }
  if (!process.env.IP_SALT) {
    avertissements.push("IP_SALT absente, repli sur AUTH_SECRET");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    avertissements.push("Supabase non configuré : magasin local JSON, non adapté à la production");
  }
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    avertissements.push("Cloudinary non configuré : les photos sont stockées en base");
  }
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    avertissements.push("NEXT_PUBLIC_SITE_URL absente : liens canoniques et Open Graph incorrects");
  }

  return { bloquants, avertissements };
}
