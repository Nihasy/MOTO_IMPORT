import { describe, expect, it } from "vitest";
import { cheminApercu, versionApercu } from "@/lib/apercu";
import type { MotoAvecMedias } from "@/lib/types";

const base = {
  slug: "kews-k16-cb250-f-2026-mi174",
  prix_ttc: 12_450_000,
  statut: "disponible",
  marque: "Kews",
  modele: "K16-CB250-F",
  annee: 2026,
  cylindree: 250,
  etat: "neuf",
  reference: "MI-174",
  categorie: "motocross",
  medias: [{ cloudinary_id: "motos/mi174-1", origine: "cloudinary" }],
} as unknown as MotoAvecMedias;

describe("image de partage versionnée", () => {
  it("change d'adresse quand le prix change (le cas Messenger 12,45 M → 13,15 M)", () => {
    const apres = { ...base, prix_ttc: 13_150_000 } as MotoAvecMedias;
    expect(versionApercu(apres)).not.toBe(versionApercu(base));
    expect(cheminApercu(apres)).not.toBe(cheminApercu(base));
  });

  it("change quand la moto est vendue ou que la photo de couverture change", () => {
    expect(versionApercu({ ...base, statut: "vendu" } as MotoAvecMedias)).not.toBe(versionApercu(base));
    const autrePhoto = { ...base, medias: [{ cloudinary_id: "motos/mi174-2", origine: "cloudinary" }] } as unknown as MotoAvecMedias;
    expect(versionApercu(autrePhoto)).not.toBe(versionApercu(base));
  });

  it("reste stable tant que rien d'affiché ne change", () => {
    const memeContenu = { ...base, description: "texte modifié" } as unknown as MotoAvecMedias;
    expect(versionApercu(memeContenu)).toBe(versionApercu(base));
    expect(cheminApercu(base)).toMatch(/^\/motos\/kews-k16-cb250-f-2026-mi174\/apercu\?v=[0-9a-f]{12}$/);
  });
});
