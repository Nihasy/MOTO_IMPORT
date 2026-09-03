import type { Metadata } from "next";
import { db } from "@/lib/db";
import { VueEnregistrees } from "@/components/catalogue/vue-enregistrees";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mes motos enregistrées",
  description: "Retrouvez les motos que vous avez enregistrées avant de décider.",
  robots: { index: false, follow: true },
};

export default async function Page() {
  const motos = await db().listerMotosPubliques();
  return <VueEnregistrees motos={motos} />;
}
