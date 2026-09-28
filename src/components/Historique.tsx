"use client";

import { useState } from "react";
import { formatDateHeure } from "@/lib/format";
import type { Categorie, Evenement } from "@/lib/historique/evenements";

const PAR_PAGE = 30;

const PASTILLES: Record<Categorie, string> = {
  statut: "bg-primaire",
  logement: "bg-slate-400",
  vacance: "bg-violet-500",
  travaux: "bg-orange-500",
  photos: "bg-teal-500",
};

/** Frise des événements d'un logement (date, heure, utilisateur, ancienne → nouvelle valeur). */
export function Historique({ evenements }: { evenements: Evenement[] }) {
  const [tout, setTout] = useState(false);
  const [nombre, setNombre] = useState(PAR_PAGE);
  const visibles = tout ? evenements : evenements.filter((e) => e.important);
  const affiches = visibles.slice(0, nombre);

  return (
    <section aria-labelledby="titre-historique" className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 id="titre-historique" className="text-base font-semibold text-slate-900">
          Historique <span className="font-normal text-slate-500">({visibles.length})</span>
        </h2>
        <div role="group" aria-label="Événements affichés" className="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {[
            { valeur: false, libelle: "Étapes clés" },
            { valeur: true, libelle: "Toutes les modifications" },
          ].map((o) => (
            <button
              key={o.libelle}
              type="button"
              aria-pressed={tout === o.valeur}
              onClick={() => {
                setTout(o.valeur);
                setNombre(PAR_PAGE);
              }}
              className={`rounded px-3 py-1 font-medium ${tout === o.valeur ? "bg-primaire text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {o.libelle}
            </button>
          ))}
        </div>
      </div>

      {affiches.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">Aucun événement.</p>
      ) : (
        <ol className="px-4 py-4">
          {affiches.map((e, i) => (
            <li key={e.cle} className="relative flex gap-3 pb-5 last:pb-0">
              {i < affiches.length - 1 && <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
              <span aria-hidden="true" className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-white ${PASTILLES[e.categorie]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{e.titre}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <time dateTime={e.date}>{formatDateHeure(e.date)}</time>
                  {" · "}
                  {e.automatique ? (
                    <>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">automatique</span>
                      {e.utilisateur && <> suite à une action de {e.utilisateur}</>}
                    </>
                  ) : (
                    (e.utilisateur ?? "Système")
                  )}
                </p>
                {e.details.length > 0 && (
                  <dl className="mt-1.5 space-y-0.5 text-xs">
                    {e.details.map((d, j) => (
                      <div key={j} className="flex flex-wrap gap-x-1.5">
                        <dt className="text-slate-500">{d.libelle} :</dt>
                        <dd className="text-slate-700">
                          {d.avant !== "—" && (
                            <>
                              <del className="text-slate-400 decoration-slate-300">{d.avant}</del>
                              <span aria-hidden="true"> → </span>
                              <span className="sr-only"> remplacé par </span>
                            </>
                          )}
                          <span className="font-medium text-slate-900">{d.apres}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {visibles.length > affiches.length && (
        <div className="border-t border-slate-200 px-4 py-3 text-center">
          <button type="button" onClick={() => setNombre((n) => n + PAR_PAGE)} className="text-sm font-medium text-primaire hover:underline">
            Afficher plus ({visibles.length - affiches.length} restants)
          </button>
        </div>
      )}
    </section>
  );
}
