import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { ar } from "@/lib/format";
import { urlMedia } from "@/lib/cloudinary";

export const alt = "Fiche moto MOTO IMPORT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Partage Facebook : photo de couverture, modèle, prix (13.1). */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const moto = await db().motoParSlug(slug);

  if (!moto) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", background: "#0E1215", color: "#E7C983",
            fontSize: 64, fontWeight: 800,
          }}
        >
          MOTO IMPORT
        </div>
      ),
      size
    );
  }

  const couverture = moto.medias[0];
  const fond = couverture ? urlMedia(couverture.cloudinary_id, "plein", { origine: couverture.origine }) : null;
  const vendu = moto.statut === "vendu";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0E1215", position: "relative" }}>
        {fond && /^https?:\/\//.test(fond) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fond}
            alt=""
            width={1200}
            height={630}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
          />
        ) : null}
        <div
          style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            justifyContent: "space-between", padding: 56,
            background: "linear-gradient(90deg, rgba(14,18,21,0.96) 30%, rgba(14,18,21,0.55) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 800, letterSpacing: 2 }}>
            <span style={{ color: "#E7C983" }}>MOTO</span>
            <span style={{ color: "#B9C2CB" }}>IMPORT</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 26, color: "#B9C2CB" }}>
              {moto.annee} · {moto.cylindree} cm³ · {moto.etat === "neuf" ? "Neuf" : "Occasion"} · réf. {moto.reference}
            </div>
            <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: "#F2F5F7", lineHeight: 1.05 }}>
              {moto.marque} {moto.modele}
            </div>
            <div
              style={{
                display: "flex", alignItems: "baseline", gap: 20, marginTop: 14,
                borderTop: "2px solid #2B333B", borderBottom: "2px solid #2B333B", padding: "18px 0",
              }}
            >
              <span
                style={{
                  fontSize: 76, fontWeight: 800,
                  color: vendu ? "#8A939C" : "#E7C983",
                  textDecoration: vendu ? "line-through" : "none",
                }}
              >
                {ar(moto.prix_ttc)}
              </span>
              {vendu ? <span style={{ fontSize: 30, color: "#B8433C", fontWeight: 700 }}>VENDU</span> : null}
            </div>
            <div style={{ display: "flex", fontSize: 27, color: "#B9C2CB", marginTop: 10 }}>
              Prix final rendu à Antananarivo · Carte grise à votre nom incluse
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
