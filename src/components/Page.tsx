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
