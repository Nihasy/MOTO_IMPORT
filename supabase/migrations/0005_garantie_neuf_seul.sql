-- MOTO IMPORT — le SAV ne couvre que le neuf.
--
-- Règle métier : seul un véhicule neuf est garanti, dans les termes fixés par
-- la marque et par le concessionnaire d'origine — durée et organes couverts
-- varient donc d'une fiche à l'autre. Une occasion est vendue en l'état, sans
-- garantie ; son honnêteté repose sur les points d'usure listés et les photos
-- datées, pas sur une couverture après-vente.
--
-- La contrainte est posée en base et pas seulement en Zod : c'est la seule
-- barrière qu'un import, un script de reprise ou une correction manuelle en
-- console ne peuvent pas contourner. Promettre une garantie sur une occasion
-- engagerait MOTO IMPORT sur un SAV qu'elle n'a pas.

-- Normalisation préalable : les fiches d'occasion déjà saisies avec une
-- garantie sont ramenées à zéro, sans quoi la contrainte serait rejetée.
update motos
   set garantie_mois  = 0,
       garantie_texte = null
 where etat = 'occasion'
   and (garantie_mois <> 0 or garantie_texte is not null);

alter table motos add constraint pas_de_garantie_si_occasion
  check (etat = 'neuf' or (garantie_mois = 0 and garantie_texte is null));

comment on constraint pas_de_garantie_si_occasion on motos is
  'Seul le neuf est garanti (CGV art. 8). Une occasion est vendue en l''état.';
