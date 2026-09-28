"use client";

import { useState, type ReactNode } from "react";

export type SerieLegende = { nom: string; classeCouleur: string };
export type DonneesTableau = { colonnes: string[]; lignes: (string | number)[][] };

/**
 * Cadre commun des graphiques : titre, sous-titre, légende (dès 2 séries) et
 * bascule « Voir le tableau » — l'équivalent accessible de chaque graphique.
 */
export function CarteGraphique({
  titre,
  sousTitre,
  legende,
  tableau,
  children,
}: {
  titre: string;
  sousTitre?: ReactNode;
  legende?: SerieLegende[];
  tableau: DonneesTableau;
  children: ReactNode;
}) {
  const [vueTableau, setVueTableau] = useState(false);

  return (
    <figure className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <figcaption className="text-sm font-semibold text-slate-900">{titre}</figcaption>
          {sousTitre && <p className="mt-0.5 text-xs text-slate-500">{sousTitre}</p>}
        </div>
        <button
          type="button"
          aria-pressed={vueTableau}
          onClick={() => setVueTableau((v) => !v)}
          className="rounded px-2 py-1 text-xs font-medium text-primaire hover:bg-primaire-clair"
        >
          {vueTableau ? "Voir le graphique" : "Voir le tableau"}
        </button>
      </div>

      {legende && legende.length > 1 && !vueTableau && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {legende.map((s) => (
            <li key={s.nom} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-[2px] ${s.classeCouleur}`} />
              {s.nom}
            </li>
          ))}
        </ul>
      )}

      {vueTableau ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                {tableau.colonnes.map((c, i) => (
                  <th key={c} scope="col" className={`border-b border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 ${i ? "text-right" : "text-left"}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableau.lignes.map((l, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  {l.map((v, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="px-2 py-1.5 text-left font-normal text-slate-700">
                        {v}
                      </th>
                    ) : (
                      <td key={j} className="px-2 py-1.5 text-right tabular-nums text-slate-900">
                        {v}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}
