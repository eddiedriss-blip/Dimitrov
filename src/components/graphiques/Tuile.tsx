import type { ReactNode } from "react";

const nombre = new Intl.NumberFormat("fr-FR");

/** Chiffre clé : libellé, valeur, précision facultative. `principal` = chiffre vedette (un seul par page). */
export function Tuile({ libelle, valeur, detail, principal }: { libelle: string; valeur: number; detail?: ReactNode; principal?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${principal ? "border-primaire/30 bg-primaire-clair" : "border-slate-200 bg-white"}`}>
      <p className="text-sm text-slate-600">{libelle}</p>
      <p className={`mt-1 font-semibold text-slate-900 ${principal ? "text-5xl" : "text-3xl"}`}>{nombre.format(valeur)}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
