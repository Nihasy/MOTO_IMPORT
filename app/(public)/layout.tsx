import { BarreInferieure } from "@/components/ui/navigation";
import { PiedDePage } from "@/components/ui/pied-de-page";
import { PorteurContact } from "@/components/ui/contexte-contact";
import { parametres } from "@/lib/parametres";

export default async function LayoutPublic({ children }: { children: React.ReactNode }) {
  // Le numéro WhatsApp se règle dans le back-office : il descend ici jusqu'aux
  // composants client qui construisent les liens de devis.
  const { whatsapp } = await parametres();
  return (
    <PorteurContact whatsapp={whatsapp}>
      {/* Largeur de page reprise de motoconcess.com : 1200px pour le listing.
          Les pages de texte se recentrent elles-memes sur 680px via `.conteneur`. */}
      <div className="mx-auto min-h-screen w-full max-w-[1200px] pb-16 lg:pb-0">{children}</div>
      <PiedDePage />
      <BarreInferieure />
    </PorteurContact>
  );
}
