"use client";

import { useState } from "react";
import type { ApercuPhoto } from "@/lib/travaux/donnees";

/**
 * Petit carrousel de miniatures (cartes « Travaux des vacants »).
 * Le cadre laisse passer le clic vers la carte (ouverture de la fiche) ; seules les flèches sont interactives.
 */
export function ApercuPhotos({ photos }: { photos: ApercuPhoto[] }) {
  const [index, setIndex] = useState(0);
  if (!photos.length) return null;
  const photo = photos[index];
  const plusieurs = photos.length > 1;
  const aller = (pas: number) => setIndex((i) => (i + pas + photos.length) % photos.length);
  const fleche =
    "relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-sm leading-none text-white opacity-90 transition hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div className="pointer-events-none relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-slate-100 shadow-sm ring-1 ring-slate-200">
      {/* Liens signés d'un bucket privé : pas d'optimisation next/image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.legende ?? ""} loading="lazy" className="h-full w-full object-cover" />
      {plusieurs && (
        <>
          <div className="absolute inset-x-1 top-1/2 flex -translate-y-1/2 justify-between">
            <button type="button" aria-label="Photo précédente" onClick={() => aller(-1)} className={`pointer-events-auto ${fleche}`}>
              ‹
            </button>
            <button type="button" aria-label="Photo suivante" onClick={() => aller(1)} className={`pointer-events-auto ${fleche}`}>
              ›
            </button>
          </div>
          <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1.5 text-[10px] font-medium tabular-nums text-white">
            {index + 1}/{photos.length}
          </span>
        </>
      )}
    </div>
  );
}
