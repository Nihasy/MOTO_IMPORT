"use client";

import type { Demande } from "@/lib/types";
import { versCsv } from "@/lib/csv";

const COLONNES = [
  "created_at", "reference", "nom", "telephone", "budget_max",
  "source", "statut", "message", "notes",
];

export function ExportDemandes({ demandes }: { demandes: Demande[] }) {
  const exporter = () => {
    const csv = versCsv(
      demandes.map((d) => ({
        created_at: d.created_at,
        reference: d.reference ?? "",
        nom: d.nom ?? "",
        telephone: d.telephone ?? "",
        budget_max: d.budget_max ?? "",
        source: d.source,
        statut: d.statut,
        message: d.message ?? "",
        notes: d.notes ?? "",
      })),
      COLONNES
    );
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demandes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <button type="button" onClick={exporter} disabled={!demandes.length} className="btn-fantome px-4 disabled:opacity-40">
      Exporter en CSV
    </button>
  );
}
