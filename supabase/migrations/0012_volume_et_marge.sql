-- MOTO IMPORT — volume de la caisse et marge manuelle d'une moto. INFORMATION INTERNE.
--
-- Le fret ne se compte plus au forfait mais au volume : m³ de la caisse ×
-- dollars par m³ (lib/tarification.ts). Chaque catégorie a un volume standard,
-- rangé dans les réglages de tarification ; cette colonne porte le volume
-- propre à une fiche quand il s'en écarte (boxer BMW, gros custom) ou que
-- l'entrepôt a mesuré la caisse. Vide : le standard de la catégorie s'applique.
--
-- `marge_ar` : marge fixée à la main pour une fiche. Elle remplace le bénéfice
-- calculé (fixe + part de l'achat). Vide : le calcul automatique s'applique ;
-- zéro est une vraie marge, la moto part à prix coûtant.
--
-- Prérequis : migration 0011 appliquée. Colonnes internes, hors de la liste des
-- colonnes lisibles par le public (0009) et de la vue `motos_publiques`.

alter table motos add column if not exists volume_m3 numeric(4, 2)
  check (volume_m3 > 0 and volume_m3 <= 10);

alter table motos add column if not exists marge_ar integer
  check (marge_ar >= 0);
