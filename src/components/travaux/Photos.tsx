"use client";

import { useRef, useState } from "react";
import { Alerte } from "@/components/formulaire";
import type { Photo } from "@/lib/travaux/types";
import { Galerie } from "./Galerie";
import { MAX_PAR_ENVOI, useEnvoiPhotos } from "./useEnvoiPhotos";

export function Photos({
  photos,
  logementId,
  vacanceId,
  lectureSeule,
}: {
  photos: Photo[];
  logementId: string;
  vacanceId: string;
  /** Archives : consultation et galerie uniquement. */
  lectureSeule?: boolean;
}) {
  const selecteur = useRef<HTMLInputElement>(null);
  const { envoi, erreurs, envoyer } = useEnvoiPhotos(logementId, vacanceId);
  const [survol, setSurvol] = useState(false);
  const [ouverte, setOuverte] = useState<number | null>(null);

  return (
    <section aria-labelledby="titre-photos" className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 id="titre-photos" className="text-base font-semibold text-slate-900">
          Photos <span className="font-normal text-slate-500">({photos.length})</span>
        </h2>
        {!lectureSeule && (
        <button
          type="button"
          onClick={() => selecteur.current?.click()}
          disabled={!!envoi}
          className="rounded-md bg-primaire px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce disabled:opacity-70"
        >
          + Ajouter des photos
        </button>
        )}
        <input
          ref={selecteur}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          hidden
          onChange={(e) => {
            void envoyer(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      <div
        className={`p-4 ${survol ? "bg-primaire-clair" : ""}`}
        onDragOver={(e) => {
          if (lectureSeule) return;
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          if (lectureSeule) return;
          e.preventDefault();
          setSurvol(false);
          void envoyer(Array.from(e.dataTransfer.files));
        }}
      >
        {envoi && (
          <div className="mb-4">
            <Alerte type="info">
              Envoi des photos… {envoi.fait}/{envoi.total}
            </Alerte>
          </div>
        )}
        {erreurs.length > 0 && (
          <div className="mb-4">
            <Alerte type="erreur">
              <ul className="list-inside list-disc space-y-0.5">
                {erreurs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Alerte>
          </div>
        )}

        {photos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
            {lectureSeule ? "Aucune photo." : "Aucune photo. Utilisez « Ajouter des photos » ou glissez-déposez vos images ici."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p.id}>
                <figure>
                  <button
                    type="button"
                    onClick={() => setOuverte(i)}
                    className="block aspect-[4/3] w-full overflow-hidden rounded-md bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire"
                    aria-label={`Agrandir ${p.legende ? `« ${p.legende} »` : `la photo ${i + 1}`}`}
                  >
                    {/* Liens signés d'un bucket privé : pas d'optimisation next/image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.urlMiniature ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
                  </button>
                  <figcaption className={`mt-1 truncate text-xs ${p.legende ? "text-slate-700" : "text-slate-400"}`} title={p.legende ?? undefined}>
                    {p.legende ?? "Sans légende"}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
        {!lectureSeule && <p className="mt-3 text-xs text-slate-500">
          JPEG, PNG ou WebP · jusqu&apos;à {MAX_PAR_ENVOI} photos à la fois · redimensionnées automatiquement avant l&apos;envoi.
        </p>}
      </div>

      {ouverte !== null && (
        <Galerie
          photos={photos}
          index={ouverte}
          logementId={logementId}
          lectureSeule={lectureSeule}
          onChangerIndex={setOuverte}
          onFermer={() => setOuverte(null)}
        />
      )}
    </section>
  );
}
