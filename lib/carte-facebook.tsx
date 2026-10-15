import "server-only";
import { ImageResponse } from "next/og";
import { urlReseau } from "./cloudinary";
import { DELAI_MAX, DELAI_MIN } from "./conditions";
import { ar, arCourt } from "./format";
import { SITE_URL } from "./site";
import { miseEnVenteDe } from "./types";
import type { LigneStudio } from "./facebook";

/**
 * Cartes du Studio Facebook, au format 4:5 (1080 × 1350) : c'est le plus haut
 * que le fil accepte sans recadrer, donc la plus grande surface d'écran par
 * photo d'un album.
 *
 * Elles ne sont jamais mises en cache côté Vercel : le Studio les fabrique à la
 * demande, pour un seul lecteur. Les ranger en cache de données rejouerait le
 * dépassement d'écritures du 10/10/2026 pour des images que personne d'autre ne
 * redemande.
 */
export const CARTE = { width: 1080, height: 1350 } as const;
const HAUTEUR_PHOTO = 810; // 4:3, le cadrage des photos du catalogue

const C = {
  fond: "#0E1215",
  surface: "#171C21",
  ligne: "#2B333B",
  texte: "#F2F5F7",
  chrome: "#B9C2CB",
  or: "#E7C983",
  orFonce: "#C08A2E",
  dispo: "#45A55A",
};

const DOMAINE = SITE_URL.replace(/^https?:\/\//, "");

/**
 * Adresse lisible par le moteur de rendu. Sans Cloudinary (magasin local), une
 * photo de démonstration est un chemin du site : il faut l'origine devant.
 */
function source(m: LigneStudio, origine: string, largeur: number, hauteur: number): string | null {
  if (!m.couverture) return null;
  const url = urlReseau(m.couverture.cloudinary_id, { origine: m.couverture.origine, largeur, hauteur });
  if (url.startsWith("/")) return `${origine}${url}`;
  return /^https?:\/\//.test(url) ? url : null;
}

/** Les noms longs (« Royal Enfield Continental GT 650 ») ne doivent pas déborder. */
const tailleTitre = (texte: string) => (texte.length > 26 ? 56 : texte.length > 18 ? 66 : 78);

function Marque({ taille = 30 }: { taille?: number }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: taille, fontWeight: 800, letterSpacing: 2 }}>
      <span style={{ color: C.or }}>MOTO</span>
      <span style={{ color: C.chrome }}>IMPORT</span>
    </div>
  );
}

export function carteMoto(m: LigneStudio, origine: string): ImageResponse {
  const photo = source(m, origine, CARTE.width, HAUTEUR_PHOTO);
  const titre = `${m.marque} ${m.modele}`;
  const local = miseEnVenteDe(m) === "local";
  const details = [
    String(m.annee),
    `${m.cylindree} cm³`,
    m.etat === "neuf" ? "Neuve" : "Occasion",
    m.etat === "occasion" && m.kilometrage ? `${m.kilometrage.toLocaleString("fr-FR")} km` : null,
  ].filter(Boolean);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.fond }}>
        <div style={{ display: "flex", width: CARTE.width, height: HAUTEUR_PHOTO, background: C.surface }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={CARTE.width} height={HAUTEUR_PHOTO} style={{ objectFit: "cover" }} />
          ) : null}
        </div>

        <div
          style={{
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            flex: 1, padding: "34px 56px 36px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 32, color: C.chrome }}>{details.join(" · ")}</div>
            <div
              style={{
                display: "flex", fontSize: tailleTitre(titre), fontWeight: 700, color: C.texte,
                lineHeight: 1.05, marginTop: 6,
              }}
            >
              {titre}
            </div>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 800, color: C.or, marginTop: 10, lineHeight: 1 }}>
              {ar(m.prix_ttc)}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Une moto sur commande n'est jamais présentée comme étant à Tana
                (référentiel de contenu, règle 11 ; CGV art. 2). */}
            <div
              style={{
                display: "flex", alignSelf: "flex-start", fontSize: 30, fontWeight: 700,
                padding: "10px 20px", letterSpacing: 1,
                color: local ? "#FFFFFF" : C.or,
                background: local ? C.dispo : "transparent",
                border: local ? `2px solid ${C.dispo}` : `2px solid ${C.orFonce}`,
              }}
            >
              {local ? "AU LOCAL À TANA · DISPONIBLE DE SUITE" : `SUR COMMANDE · ${DELAI_MIN} À ${DELAI_MAX} JOURS`}
            </div>
            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                borderTop: `2px solid ${C.ligne}`, paddingTop: 18,
              }}
            >
              <Marque />
              <div style={{ display: "flex", fontSize: 28, color: C.chrome }}>
                réf. {m.reference} · {DOMAINE}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    CARTE
  );
}

/**
 * Première image de l'album : le titre et un aperçu des quatre premières motos,
 * avec la fourchette de prix. C'est elle qui occupe la grande case du fil.
 */
export function carteCouverture(titre: string, motos: LigneStudio[], origine: string): ImageResponse {
  const apercu = motos.slice(0, 4);
  const prix = motos.map((m) => m.prix_ttc);
  const fourchette =
    prix.length === 0
      ? ""
      : Math.min(...prix) === Math.max(...prix)
        ? arCourt(prix[0])
        : `${arCourt(Math.min(...prix))} → ${arCourt(Math.max(...prix))}`;
  const case_ = { l: 474, h: 356 };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: C.fond, padding: 56,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Marque taille={34} />
          <div
            style={{
              display: "flex", fontSize: titre.length > 40 ? 64 : 80, fontWeight: 800,
              color: C.texte, lineHeight: 1.05,
            }}
          >
            {titre}
          </div>
          <div style={{ display: "flex", fontSize: 38, color: C.or, fontWeight: 700 }}>
            {motos.length} moto{motos.length > 1 ? "s" : ""} · {fourchette}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {apercu.map((m) => {
            const photo = source(m, origine, case_.l, case_.h);
            return (
              <div
                key={m.reference}
                style={{
                  display: "flex", position: "relative", width: case_.l, height: case_.h,
                  background: C.surface,
                }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" width={case_.l} height={case_.h} style={{ objectFit: "cover" }} />
                ) : null}
                <div
                  style={{
                    position: "absolute", left: 0, bottom: 0, display: "flex",
                    padding: "8px 14px", background: "rgba(14,18,21,0.88)",
                    fontSize: 28, fontWeight: 800, color: C.or,
                  }}
                >
                  {arCourt(m.prix_ttc)}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex", justifyContent: "space-between", fontSize: 30, color: C.chrome,
            borderTop: `2px solid ${C.ligne}`, paddingTop: 18,
          }}
        >
          <span>Prix et lien de chaque moto dans les photos</span>
          <span>{DOMAINE}</span>
        </div>
      </div>
    ),
    CARTE
  );
}
