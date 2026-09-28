import type { ReactNode } from "react";

export function TitrePage({
  titre,
  description,
  sansBordure,
}: {
  titre: string;
  description?: ReactNode;
  /** Quand le titre est déjà placé dans un bandeau qui porte sa propre bordure. */
  sansBordure?: boolean;
}) {
  return (
    <div className={sansBordure ? "" : "mb-6 border-b border-slate-200 pb-4"}>
      <h1 className="text-2xl font-semibold text-slate-900">{titre}</h1>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    </div>
  );
}

/** Emplacement provisoire tant que le contenu de la page n'est pas développé. */
export function ContenuAVenir() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
      Contenu à venir.
    </div>
  );
}
