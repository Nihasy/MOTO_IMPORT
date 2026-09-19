"use client";

import { useState } from "react";
import clsx from "clsx";

/** « 18600000 » → « 18 600 000 » ; « 670,5 » → « 670,5 ». */
export function formaterMontant(brut: string, decimales = false): string {
  const propre = decimales ? brut.replace(/[^\d,.]/g, "").replace(".", ",") : brut.replace(/[^\d]/g, "");
  const [entiere, ...reste] = propre.split(",");
  const groupee = entiere.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decimales && reste.length ? `${groupee},${reste.join("").slice(0, 2)}` : groupee;
}

/** Valeur envoyée au serveur : chiffres seuls, point décimal. */
export const valeurBrute = (affiche: string) => affiche.replace(/[^\d,]/g, "").replace(",", ".");

/**
 * Champ de montant avec séparateurs de milliers pendant la saisie.
 *
 * Le champ visible n'a pas de `name` : il affiche « 18 600 000 ». Un champ
 * caché porte la valeur brute (18600000), la seule que le serveur lise — le
 * formatage reste une affaire d'affichage.
 */
export function ChampMontant({
  id,
  name,
  defaultValue,
  required,
  decimales = false,
  suffixe,
  placeholder,
  disabled,
  className,
  onValeur,
}: {
  id: string;
  name: string;
  defaultValue?: number | string | null;
  required?: boolean;
  decimales?: boolean;
  suffixe?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onValeur?: (valeur: number | null) => void;
}) {
  const depart = defaultValue === null || defaultValue === undefined ? "" : String(defaultValue).replace(".", ",");
  const [affiche, setAffiche] = useState(formaterMontant(depart, decimales));
  const brute = valeurBrute(affiche);

  return (
    <div className="relative">
      <input
        id={id}
        inputMode={decimales ? "decimal" : "numeric"}
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={affiche}
        onChange={(e) => {
          const f = formaterMontant(e.target.value, decimales);
          setAffiche(f);
          const v = valeurBrute(f);
          onValeur?.(v ? Number(v) : null);
        }}
        className={clsx("champ tabular-nums", suffixe && "pr-12", className)}
      />
      {suffixe ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-meta text-dim">
          {suffixe}
        </span>
      ) : null}
      <input type="hidden" name={name} value={brute} disabled={disabled} />
    </div>
  );
}
