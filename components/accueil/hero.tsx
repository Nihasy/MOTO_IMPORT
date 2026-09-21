import Image from "next/image";
import Link from "next/link";

/**
 * Accroche d'accueil : la moto occupe le fond, le texte et les deux actions
 * se posent dessus.
 *
 * Disposition reprise de la maquette de référence, couleurs et vocabulaire du
 * site : l'or #C08A2E et son clair, le fond #0E1215, et l'accroche telle
 * qu'elle était déjà écrite. Les faits imposés par les CGV — prix rendu Tana,
 * carte grise au nom de l'acheteur, 45 à 65 jours — restent où ils servent à
 * décider : sur chaque carte du catalogue et sur chaque fiche.
 *
 * Mobile d'abord : une colonne, les deux actions calées sur la largeur de la
 * plus longue plutôt qu'étirées d'un bord à l'autre. À partir de `lg`, le
 * texte se range sur la moitié gauche et la moto occupe la droite, dégagée
 * par le dégradé.
 */

export function Hero() {
  return (
    <section className="relative isolate -mx-4 overflow-hidden border-b border-line">
      {/* La photo est décorative : l'accroche dit déjà ce que la page promet,
          et la décrire une seconde fois ne ferait qu'allonger la lecture au
          lecteur d'écran. */}
      <Image
        src="/accueil/r1.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        /* La source est un portrait 1024x1536 : quelle que soit la largeur du
           hero, elle déborde en hauteur et c'est la position verticale qui
           décide de ce qu'on voit. La moto occupe la bande 36-91 % ; viser
           58 % la met en vue, alors qu'un cadrage centré n'aurait montré que
           le ciel. Sur grand écran la bande visible est plus étroite, on
           remonte un peu pour garder le carénage plutôt que le bitume. */
        className="-z-10 object-cover object-[55%_58%] lg:object-[60%_52%]"
      />

      {/* Deux voiles plutôt qu'un : le vertical assoit le bandeau de
          promesses sur du sombre, l'horizontal dégage la moto à droite sur
          grand écran. Sans eux, le texte blanc passe sur le coucher de soleil
          et devient illisible — c'est le contraste qui commande, pas le goût. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-bg/95 via-bg/75 to-bg" />
      {/* Sur téléphone le texte court sur presque toute la largeur : le voile
          horizontal ne peut pas s'ouvrir aussi tôt que sur grand écran, où la
          moitié droite est libre et doit laisser voir la moto. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/80 to-bg/20 lg:via-bg/60 lg:to-transparent"
      />

      <div className="conteneur-large pb-14 pt-12 sm:pt-16 lg:pb-24 lg:pt-28">
        <div className="max-w-[34rem] lg:max-w-[38rem]">
          <h1 className="text-[34px] font-extrabold leading-[1.06] tracking-tight sm:text-[46px] lg:text-[54px] xl:text-[60px]">
            Votre prochaine
            <br />
            <span className="text-gold-light">moto vous attend.</span>
          </h1>

          <p className="mt-5 text-[18px] font-medium leading-[1.5] text-chrome sm:text-[20px]">
            Dites-nous laquelle. Nous allons la chercher.
          </p>

          {/* Le trait en biais de la maquette, repris en dégradé d'or : seule
              ornementation de l'accroche, et le même geste que la barre
              oblique des titres de section. */}
          <span
            aria-hidden
            className="mt-6 block h-[3px] w-28 -skew-x-[30deg] bg-gradient-to-r from-gold to-transparent"
          />

          {/* `w-fit` sur la colonne : les deux boutons adoptent la largeur du
              plus long — « Voir le catalogue » — au lieu de courir d'un bord
              à l'autre de l'écran. Ils restent alignés entre eux, et la moto
              garde de la place à droite dès le téléphone. */}
          <div className="mt-8 flex w-fit max-w-full flex-col gap-3">
            <Link href="/motos" className="btn-or h-[52px] justify-between gap-3 px-5 text-[16px]">
              <IconeLoupe />
              <span className="flex-1 text-left">Voir le catalogue</span>
              <IconeFleche />
            </Link>
            <Link href="/contact" className="btn-fantome h-[52px] justify-between gap-3 px-5 text-[16px]">
              <IconeUtilisateur />
              <span className="flex-1 text-left">Nous contacter</span>
              <IconeFleche />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Pictogrammes au trait, sur la grille 24 de la barre de navigation : même
   épaisseur, même arrondi, donc même famille visuelle d'un écran à l'autre. */

function IconeLoupe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function IconeUtilisateur() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
    </svg>
  );
}

function IconeFleche() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h13" />
      <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  );
}
