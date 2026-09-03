-- MOTO IMPORT — élargissement des catégories de véhicules.
-- Le catalogue expose désormais les sept types annoncés en tête de catalogue :
-- routière, sportive, roadster, trail, custom, cross, scooter.
-- Les valeurs existantes sont conservées telles quelles ; « motocross » reste
-- la valeur stockée et s'affiche « Cross ».

alter type moto_categorie add value if not exists 'routiere' before 'sportive';
alter type moto_categorie add value if not exists 'scooter';
