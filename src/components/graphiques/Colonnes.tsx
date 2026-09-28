"use client";

import { useState } from "react";

export type SerieColonnes = { nom: string; classeCouleur: string; valeurs: (number | null)[] };

const nombre = new Intl.NumberFormat("fr-FR");

/** Graduations « rondes » (1, 2, 5 × 10ⁿ), 5 au plus. */
export function graduations(max: number): number[] {
  if (max <= 0) return [0, 1];
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? puissance * 10;
  const pasEntier = Math.max(1, Math.ceil(pas));
  const haut = Math.ceil(max / pasEntier) * pasEntier;
  return Array.from({ length: haut / pasEntier + 1 }, (_, i) => i * pasEntier);
}

/**
 * Colonnes (groupées si plusieurs séries), une seule échelle.
 * Survol / focus d'une colonne = infobulle avec toutes les séries de cette catégorie.
 */
export function Colonnes({
  categories,
  libellesComplets,
  series,
  surligne,
  hauteur = 200,
}: {
  categories: string[];
  /** Libellés longs pour l'infobulle (ex. « mars 2026 »). */
  libellesComplets?: string[];
  series: SerieColonnes[];
  /** Index de la catégorie mise en avant (ex. mois filtré). */
  surligne?: number | null;
  hauteur?: number;
}) {
  const [actif, setActif] = useState<number | null>(null);
  const valeurs = series.flatMap((s) => s.valeurs.filter((v): v is number => v !== null));
  const ticks = graduations(Math.max(0, ...valeurs));
  const max = ticks[ticks.length - 1];
  const n = categories.length;

  // étiquette directe : uniquement la valeur maximale d'une série unique
  const indexMax =
    series.length === 1 ? series[0].valeurs.reduce<number>((m, v, i, t) => (v !== null && v > (t[m] ?? -1) ? i : m), 0) : -1;

  const pourcent = (v: number) => `${(v / max) * 100}%`;
  const libelleComplet = (i: number) => libellesComplets?.[i] ?? categories[i];
  const resume = (i: number) =>
    `${libelleComplet(i)} : ${series.map((s) => `${s.nom} ${s.valeurs[i] === null ? "non disponible" : nombre.format(s.valeurs[i]!)}`).join(", ")}`;

  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)]">
      {/* Axe vertical */}
      <div className="relative" style={{ height: hauteur }} aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute right-2 translate-y-1/2 text-[11px] tabular-nums text-encre-attenuee" style={{ bottom: pourcent(t) }}>
            {nombre.format(t)}
          </span>
        ))}
      </div>

      {/* Zone de tracé */}
      <div className="relative" style={{ height: hauteur }}>
        {ticks.map((t) => (
          <div key={t} aria-hidden="true" className={`absolute inset-x-0 h-px ${t === 0 ? "bg-axe" : "bg-grille"}`} style={{ bottom: pourcent(t) }} />
        ))}

        <div role="list" className="absolute inset-0 flex">
          {categories.map((c, i) => {
            const vide = series.every((s) => s.valeurs[i] === null);
            return (
              <div
                key={c}
                role="listitem"
                tabIndex={0}
                aria-label={resume(i)}
                onPointerEnter={() => setActif(i)}
                onPointerLeave={() => setActif(null)}
                onFocus={() => setActif(i)}
                onBlur={() => setActif(null)}
                className={`relative flex h-full flex-1 justify-center outline-none focus-visible:ring-2 focus-visible:ring-primaire ${
                  actif === i ? "bg-slate-100/70" : ""
                }`}
              >
                {/* largeur relative à la colonne (un padding en % serait relatif au parent) */}
                <div className="flex h-full w-[70%] items-end justify-center gap-[2px]">
                {!vide &&
                  series.map((s) => {
                    const v = s.valeurs[i];
                    if (v === null) return null;
                    return (
                      <div key={s.nom} className="relative flex h-full max-w-6 flex-1 items-end">
                        <div
                          className={`w-full rounded-t-[4px] ${s.classeCouleur} ${actif === i ? "brightness-110" : ""}`}
                          style={{ height: v > 0 ? `max(2px, ${pourcent(v)})` : 0 }}
                        />
                        {i === indexMax && v > 0 && (
                          <span className="absolute left-1/2 -translate-x-1/2 -translate-y-full pb-0.5 text-[11px] font-medium text-slate-700" style={{ bottom: pourcent(v) }}>
                            {nombre.format(v)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {actif !== null && (
          <div
            role="presentation"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={
              actif < n / 2
                ? { left: `calc(${((actif + 0.5) / n) * 100}% + 12px)` }
                : { right: `calc(${((n - actif - 0.5) / n) * 100}% + 12px)` }
            }
          >
            <p className="mb-1 font-medium text-slate-600">{libelleComplet(actif)}</p>
            {series.map((s) => (
              <p key={s.nom} className="flex items-center gap-2 whitespace-nowrap">
                <span aria-hidden="true" className={`h-0.5 w-3 rounded ${s.classeCouleur}`} />
                <strong className="text-sm font-semibold text-slate-900">
                  {s.valeurs[actif] === null ? "—" : nombre.format(s.valeurs[actif]!)}
                </strong>
                <span className="text-slate-500">{s.nom}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Axe horizontal */}
      <div />
      <div className="mt-1.5 flex" aria-hidden="true">
        {categories.map((c, i) => (
          // largeur fixe (celle de la colonne) ; le texte peut déborder, centré, sur les voisins masqués
          <span
            key={c}
            className={`flex min-w-0 flex-1 justify-center text-[11px] ${
              i === surligne ? "font-semibold text-slate-900" : "text-encre-attenuee"
            } ${n > 8 && i % 2 === 1 ? "invisible sm:visible" : ""}`}
          >
            <span className="whitespace-nowrap">{c}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
