import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import { MesureAudience } from "@/components/ui/mesure-audience";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-open-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MOTO IMPORT — Motos importées, rendues à Antananarivo carte grise incluse",
    template: "%s | MOTO IMPORT",
  },
  description:
    "Catalogue de motos neuves et d'occasion importées de Chine. Prix final rendu à Antananarivo, carte grise établie à votre nom, livraison en 45 à 65 jours.",
  keywords: [
    "moto 400cc Madagascar",
    "importation moto Tana",
    "acheter moto Antananarivo",
    "moto occasion Madagascar",
  ],
  openGraph: {
    type: "website",
    locale: "fr_MG",
    siteName: "MOTO IMPORT",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0E1215",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={openSans.variable}>
      <body>
        {children}
        <MesureAudience />
      </body>
    </html>
  );
}
