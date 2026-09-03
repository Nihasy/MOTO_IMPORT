import Link from "next/link";

export default function Introuvable() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-[52px] font-extrabold leading-none text-gold-light">404</p>
      <h1 className="mt-2 text-titre-fiche">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-sm text-corps text-chrome">
        Le lien est peut-etre incomplet. Le catalogue, lui, est toujours a jour.
      </p>
      <Link href="/motos" className="btn-or mt-5 px-6">Voir le catalogue</Link>
    </div>
  );
}
