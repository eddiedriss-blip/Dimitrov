"use client";

import { useRef, useState } from "react";
import { Alerte } from "@/components/formulaire";
import type { Photo } from "@/lib/travaux/types";
import { Galerie } from "./Galerie";
import { useEnvoiPhotos } from "./useEnvoiPhotos";

/** Photos sur téléphone : gros boutons appareil photo / galerie, miniatures, galerie plein écran (légende, suppression). */
export function PhotosTelephone({ photos, logementId, vacanceId }: { photos: Photo[]; logementId: string; vacanceId: string }) {
  const appareil = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);
  const { envoi, erreurs, envoyer } = useEnvoiPhotos(logementId, vacanceId);
  const [ajoutees, setAjoutees] = useState(0);
  const [ouverte, setOuverte] = useState<number | null>(null);

  const choisir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    setAjoutees(0);
    setAjoutees(await envoyer(fichiers));
  };
  const bouton =
    "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-5 text-base font-semibold shadow-sm disabled:opacity-60";

  return (
    <section aria-labelledby="titre-photos" className="space-y-4">
      <h2 id="titre-photos" className="text-lg font-semibold text-slate-900">
        Photos <span className="font-normal text-slate-500">({photos.length})</span>
      </h2>

      <div className="flex gap-3">
        <button type="button" disabled={!!envoi} onClick={() => appareil.current?.click()} className={`${bouton} bg-primaire text-white active:bg-primaire-fonce`}>
          <span aria-hidden="true" className="text-2xl">
            📷
          </span>
          Prendre une photo
        </button>
        <button type="button" disabled={!!envoi} onClick={() => galerie.current?.click()} className={`${bouton} border border-slate-300 bg-white text-slate-800 active:bg-slate-50`}>
          <span aria-hidden="true" className="text-2xl">
            🖼️
          </span>
          Depuis la galerie
        </button>
      </div>
      <input ref={appareil} type="file" accept="image/*" capture="environment" hidden onChange={choisir} />
      <input ref={galerie} type="file" accept="image/*" multiple hidden onChange={choisir} />

      {envoi && (
        <Alerte type="info">
          Envoi en cours… {envoi.fait}/{envoi.total} — gardez cette page ouverte.
        </Alerte>
      )}
      {!envoi && ajoutees > 0 && (
        <Alerte type="succes">
          {ajoutees} photo{ajoutees > 1 ? "s ajoutées" : " ajoutée"}.
        </Alerte>
      )}
      {erreurs.length > 0 && (
        <Alerte type="erreur">
          <ul className="list-inside list-disc space-y-0.5">
            {erreurs.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alerte>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOuverte(i)}
                className="block aspect-square w-full overflow-hidden rounded-lg bg-slate-100"
                aria-label={`Agrandir ${p.legende ? `« ${p.legende} »` : `la photo ${i + 1}`}`}
              >
                {/* Liens signés d'un bucket privé : pas d'optimisation next/image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.urlMiniature ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {ouverte !== null && (
        <Galerie photos={photos} index={ouverte} logementId={logementId} onChangerIndex={setOuverte} onFermer={() => setOuverte(null)} />
      )}
    </section>
  );
}
