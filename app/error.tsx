"use client";

import { useEffect } from "react";

export default function Erreur({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-titre-fiche">Une erreur est survenue</h1>
      <p className="mt-2 max-w-sm text-corps text-chrome">
        Le site n&apos;a pas pu afficher cette page. Reessayez dans un instant.
      </p>
      <button type="button" onClick={reset} className="btn-or mt-5 px-6">Reessayer</button>
    </div>
  );
}
