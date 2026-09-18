/**
 * Environnement commun aux scripts de recette, de sécurité et de charge.
 *
 * Ces scripts tournent sous Node nu : personne ne leur charge `.env.local`,
 * que Next lit de son côté. Sans cette lecture, ils signaient leurs cookies
 * avec un secret que le serveur ne reconnaît pas, et tout le back-office
 * apparaissait en échec alors qu'il fonctionnait.
 */
import { readFile } from "node:fs/promises";

/**
 * Secret de repli de `lib/config.ts`, écrit en clair dans le dépôt public.
 * Il doit rester identique à l'original : c'est lui qu'un attaquant essaierait,
 * et c'est donc lui que le test d'attaque doit essayer.
 */
export const SECRET_DEV = "developpement-uniquement-ne-jamais-utiliser-en-production";

export async function chargerEnvLocal() {
  for (const fichier of [".env.local", ".env"]) {
    let brut;
    try {
      brut = await readFile(fichier, "utf8");
    } catch {
      continue;
    }
    for (const ligne of brut.split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      // L'environnement réel prime : il permet de viser un autre serveur.
      if (process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
      }
    }
  }
}

/** Secret de session tel que le serveur le choisit (`secretSession`). */
export const secretSession = () =>
  process.env.AUTH_SECRET?.length >= 16 ? process.env.AUTH_SECRET : SECRET_DEV;
