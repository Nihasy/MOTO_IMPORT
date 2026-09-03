"""Fabrique les masques de pictogrammes de type à partir des sources.

    python scripts/detourage-types.py [--apercu]

Lit `SET_MOTO_REPRESENTATION/*.png` et écrit `public/types/<categorie>.png`.

Les sources sont des captures à deux couleurs : un fond (#EBEEF5) et une encre
(#1D2840), sans transparence. Plutôt que de seuiller, on résout pour chaque
pixel le taux de mélange entre les deux, qui devient l'alpha : l'anticrénelage
est conservé et les trous intérieurs — moyeux, plaque numéro — se vident seuls.

Le résultat est un masque à canal alpha, appliqué en `mask-image` sur un aplat
de `currentColor` (voir components/catalogue/icones-types.tsx). Un PNG en
niveaux de gris sans alpha serait interprété comme entièrement opaque.

Les sept glyphes viennent d'une même fonte : ils partagent donc déjà la bonne
échelle relative. On se contente de les rogner, de les poser sur un canevas
commun aligné sur la ligne de sol, et de les centrer. `RETOUCHE` permet de
corriger une icône isolée si une source était capturée à un autre zoom.

Prérequis : pillow et numpy (`pip install pillow numpy`).
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RACINE, "SET_MOTO_REPRESENTATION")
OUT = os.path.join(RACINE, "public", "types")

FOND = np.array([235, 238, 245], float)
ENCRE = np.array([29, 40, 64], float)

# fichier source -> clé de catégorie du catalogue (lib/types.ts)
FICHIERS = [
    ("ROUTIERE.png", "routiere"),
    ("SPORTIVE.png", "sportive"),
    ("ROADSTER.png", "roadster"),
    ("TRAIL.png", "trail"),
    ("CUSTOM.png", "custom"),
    ("CROSS.png", "motocross"),
    ("SCOOT.png", "scooter"),
]

# Retouche par icône, appliquée après la normalisation automatique.
# echelle : 1.0 = taille d'origine ; dx : décalage horizontal en pixels.
RETOUCHE: dict[str, dict[str, float]] = {}

MARGE = 3


def taux_de_melange(rgb: np.ndarray) -> np.ndarray:
    """Part d'encre de chaque pixel, par moindres carrés sur les trois canaux."""
    d = ENCRE - FOND
    return np.clip(((rgb - FOND) @ d) / (d @ d), 0.0, 1.0)


def residu_max(rgb: np.ndarray, t: np.ndarray) -> float:
    """Écart à la droite fond→encre. Un résidu élevé trahit une 3e couleur."""
    return float(np.abs(rgb - (FOND + t[..., None] * (ENCRE - FOND))).max())


def main() -> int:
    if not os.path.isdir(SRC):
        print(f"sources introuvables : {SRC}", file=sys.stderr)
        return 1

    masques = []
    for nom, cle in FICHIERS:
        chemin = os.path.join(SRC, nom)
        rgb = np.array(Image.open(chemin).convert("RGB")).astype(float)
        t = taux_de_melange(rgb)
        residu = residu_max(rgb, t)
        t[t < 0.02] = 0.0

        ys, xs = np.where(t > 0.05)
        contenu = t[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
        masques.append({"cle": cle, "m": contenu})
        h, w = contenu.shape
        print(f"{nom:14s} -> {cle:10s} contenu {w:3d}x{h:3d}  residu max {residu:5.1f}")

    largeur = max(m["m"].shape[1] for m in masques) + 2 * MARGE
    hauteur = max(m["m"].shape[0] for m in masques) + 2 * MARGE
    print(f"\ncanevas commun {largeur}x{hauteur}")

    os.makedirs(OUT, exist_ok=True)
    for m in masques:
        retouche = RETOUCHE.get(m["cle"], {})
        echelle = float(retouche.get("echelle", 1.0))
        dx = int(retouche.get("dx", 0))

        src = m["m"]
        if echelle != 1.0:
            im = Image.fromarray((src * 255).astype(np.uint8), "L")
            im = im.resize(
                (max(1, round(im.width * echelle)), max(1, round(im.height * echelle))),
                Image.LANCZOS,
            )
            src = np.array(im).astype(float) / 255.0

        h, w = src.shape
        toile = np.zeros((hauteur, largeur), float)
        haut = max(0, min(hauteur - MARGE - h, hauteur - h))
        gauche = max(0, min((largeur - w) // 2 + dx, largeur - w))
        toile[haut: haut + h, gauche: gauche + w] = src
        m["toile"] = toile

        alpha = Image.fromarray((toile * 255).astype(np.uint8), "L")
        blanc = Image.new("L", alpha.size, 255)
        cible = os.path.join(OUT, m["cle"] + ".png")
        Image.merge("LA", [blanc, alpha]).save(cible, optimize=True)
        print(f"  {m['cle']:10s} {w}x{h} -> ({gauche},{haut})  {os.path.getsize(cible)} o")

    if "--apercu" in sys.argv:
        ecrire_apercu(masques, largeur, hauteur)
    return 0


def ecrire_apercu(masques, largeur: int, hauteur: int) -> None:
    """Planche de contrôle : rendu chrome sur fond de tuile, en grand et à la
    taille réellement affichée dans le catalogue."""
    chrome = np.array([185, 194, 203], float)
    surface = np.array([23, 28, 33], float)

    def rendu(toile, larg):
        im = Image.fromarray((toile * 255).astype(np.uint8), "L").resize(
            (larg, round(larg * hauteur / largeur)), Image.LANCZOS
        )
        t = np.array(im).astype(float)[..., None] / 255.0
        return Image.fromarray((surface * (1 - t) + chrome * t).astype(np.uint8), "RGB")

    for larg, suffixe, pad in ((190, "grand", 14), (61, "reel", 6)):
        tuiles = [rendu(m["toile"], larg) for m in masques]
        planche = Image.new(
            "RGB",
            (len(tuiles) * (larg + pad) + pad, tuiles[0].height + 2 * pad),
            (14, 18, 21),
        )
        for i, tuile in enumerate(tuiles):
            planche.paste(tuile, (pad + i * (larg + pad), pad))
        cible = os.path.join(OUT, f"_apercu-{suffixe}.png")
        planche.save(cible)
        print(f"aperçu : {cible}")


if __name__ == "__main__":
    raise SystemExit(main())
