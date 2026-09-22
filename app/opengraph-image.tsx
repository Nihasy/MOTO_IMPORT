import { ImageResponse } from "next/og";
import { FOURCHETTE_DELAI_TEXTE } from "@/lib/conditions";

export const alt = "MOTO IMPORT — motos importées rendues à Antananarivo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "#0E1215",
        }}
      >
        <div style={{ display: "flex", gap: 14, fontSize: 34, fontWeight: 800, letterSpacing: 3 }}>
          <span style={{ color: "#E7C983" }}>MOTO</span>
          <span style={{ color: "#B9C2CB" }}>IMPORT</span>
        </div>
        <div style={{ display: "flex", marginTop: 26, fontSize: 62, fontWeight: 700, color: "#F2F5F7", lineHeight: 1.1 }}>
          La moto que vous voulez,
        </div>
        <div style={{ display: "flex", fontSize: 62, fontWeight: 700, color: "#E7C983", lineHeight: 1.1 }}>
          rendue à Tana, carte grise incluse.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 34,
            paddingTop: 22,
            borderTop: "2px solid #2B333B",
            fontSize: 28,
            color: "#B9C2CB",
          }}
        >
          {`Neuf et occasion · Livraison ${FOURCHETTE_DELAI_TEXTE} · Prix final, sans frais découverts`}
        </div>
      </div>
    ),
    size
  );
}
