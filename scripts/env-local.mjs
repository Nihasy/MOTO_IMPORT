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

/**
 * Garde-fou : ces trois recettes écrivent pour de bon. La charge crée quarante
 * demandes par passage, la sécurité en pousse quatre-vingt-dix pour éprouver
 * la limitation de flot, la recette importe des motos et des médias. Tant que
 * le magasin est le JSON local, c'est sans conséquence. Dès qu'une base
 * Supabase est configurée, ces lignes atterrissent dans le back-office et se
 * mêlent aux vraies demandes — une seule campagne de validation en a produit
 * plus de deux cents, indiscernables au premier coup d'œil d'un afflux de
 * prospects.
 *
 * Le refus est donc la position par défaut, et il faut une intention écrite
 * pour passer outre.
 */
export function exigerBaseDeTest(nom) {
  const surSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const base = process.env.E2E_BASE ?? "http://localhost:3000";
  const distant = !/^https?:\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(base);
  if (!surSupabase && !distant) return;

  if (process.env.RECETTE_ECRIT_EN_BASE_REELLE === "1") {
    console.warn(
      `\n  ⚠  ${nom} écrit dans une base réelle (${surSupabase ? "Supabase" : base}).` +
        `\n     Autorisé par RECETTE_ECRIT_EN_BASE_REELLE=1. Les demandes et motos` +
        `\n     créées resteront en base : pensez à les retirer.\n`
    );
    return;
  }

  console.error(
    `\n  ✖  ${nom} refuse de tourner : la cible n'est pas une base de test.` +
      (surSupabase ? `\n     NEXT_PUBLIC_SUPABASE_URL est défini — les écritures iraient dans Supabase.` : "") +
      (distant ? `\n     E2E_BASE vise ${base}, qui n'est pas la machine locale.` : "") +
      `\n\n     Ces recettes créent des demandes, des motos et des médias. Sur une` +
      `\n     base réelle, elles polluent le back-office.` +
      `\n\n     Pour tourner proprement : lancer l'application sans variables` +
      `\n     Supabase (le magasin JSON local prend le relais).` +
      `\n     Pour passer outre en connaissance de cause :` +
      `\n       RECETTE_ECRIT_EN_BASE_REELLE=1 npm run <recette>\n`
  );
  process.exit(1);
}
