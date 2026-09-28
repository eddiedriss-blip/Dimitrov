"use client";

import { useState, type ReactNode } from "react";

export type LigneBarre = { cle: string; libelle: ReactNode; texte: string; valeur: number };

const nombre = new Intl.NumberFormat("fr-FR");

/**
 * Barres horizontales, une seule série (une seule couleur) : répartition par catégorie.
 * Valeur au bout de chaque barre ; au survol / focus, la part du total.
 */
export function Barres({ lignes, unite = "logement" }: { lignes: LigneBarre[]; unite?: string }) {
  const [actif, setActif] = useState<string | null>(null);
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  const total = lignes.reduce((s, l) => s + l.valeur, 0);

  if (!lignes.length) return <p className="py-8 text-center text-sm text-slate-500">Aucune donnée pour ces filtres.</p>;

  return (
    <ul className="space-y-2">
      {lignes.map((l) => {
        const part = total ? Math.round((100 * l.valeur) / total) : 0;
        return (
          <li
            key={l.cle}
            tabIndex={0}
            aria-label={`${l.texte} : ${nombre.format(l.valeur)} ${unite}${l.valeur > 1 ? "s" : ""}, ${part} % du total`}
            onPointerEnter={() => setActif(l.cle)}
            onPointerLeave={() => setActif(null)}
            onFocus={() => setActif(l.cle)}
            onBlur={() => setActif(null)}
            className={`relative grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primaire sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] ${
              actif === l.cle ? "bg-slate-50" : ""
            }`}
          >
            <span className="truncate text-sm text-slate-700" title={l.texte}>
              {l.libelle}
            </span>
            {/* piste : la longueur de la barre est strictement proportionnelle à la valeur */}
            <span className="flex h-4 items-center">
              <span
                className={`h-4 rounded-r-[4px] bg-serie-1 ${actif === l.cle ? "brightness-110" : ""}`}
                style={{ width: l.valeur > 0 ? `max(2px, ${(l.valeur / max) * 100}%)` : 0 }}
              />
            </span>
            <span className="whitespace-nowrap text-sm tabular-nums text-slate-900">
              {nombre.format(l.valeur)}
              {actif === l.cle && <span className="ml-1 text-xs text-slate-500">{part} %</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
