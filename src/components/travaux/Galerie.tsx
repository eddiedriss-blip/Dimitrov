"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatDate } from "@/lib/format";
import type { Photo } from "@/lib/travaux/types";
import { modifierLegende, supprimerPhoto } from "@/app/(app)/travaux/actions";

/** Agrandissement en plein écran : flèches, clavier (← → Échap), glissement du doigt, légende, suppression. */
export function Galerie({
  photos,
  index,
  logementId,
  lectureSeule,
  onChangerIndex,
  onFermer,
}: {
  photos: Photo[];
  index: number;
  logementId: string;
  lectureSeule?: boolean;
  onChangerIndex: (i: number) => void;
  onFermer: () => void;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const departGlisser = useRef<number | null>(null);
  const photo = photos[index];
  const [legende, setLegende] = useState(photo?.legende ?? "");
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [message, setMessage] = useState<{ type: "erreur" | "succes"; texte: string }>();
  const [enCours, demarrer] = useTransition();

  // Nouvelle photo affichée (ou légende mise à jour par le serveur) : on réinitialise l'édition.
  const [vue, setVue] = useState({ id: photo?.id, legende: photo?.legende });
  if (photo && (vue.id !== photo.id || vue.legende !== photo.legende)) {
    setVue({ id: photo.id, legende: photo.legende });
    setLegende(photo.legende ?? "");
    setConfirmerSuppression(false);
    if (vue.id !== photo.id) setMessage(undefined);
  }

  useEffect(() => {
    dialogue.current?.showModal();
  }, []);

  // La photo a disparu (supprimée) : on ferme.
  useEffect(() => {
    if (!photo) dialogue.current?.close();
  }, [photo]);

  if (!photo) return null;

  const aller = (pas: number) => onChangerIndex((index + pas + photos.length) % photos.length);

  const enregistrerLegende = () =>
    demarrer(async () => {
      const r = await modifierLegende(photo.id, logementId, legende);
      setMessage(r.erreur ? { type: "erreur", texte: r.erreur } : { type: "succes", texte: "Légende enregistrée." });
    });

  const supprimer = () =>
    demarrer(async () => {
      const r = await supprimerPhoto(photo.id, logementId);
      if (r.erreur) {
        setMessage({ type: "erreur", texte: r.erreur });
        return;
      }
      if (photos.length <= 1) dialogue.current?.close();
      else if (index === photos.length - 1) onChangerIndex(index - 1);
    });

  return (
    <dialog
      ref={dialogue}
      aria-label={`Photo ${index + 1} sur ${photos.length}`}
      onClose={onFermer}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") return;
        if (e.key === "ArrowLeft") aller(-1);
        if (e.key === "ArrowRight") aller(1);
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-slate-950 p-0 text-white backdrop:bg-slate-950"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-slate-300">
            {index + 1} / {photos.length} · ajoutée le {formatDate(photo.created_at)}
          </p>
          <button type="button" onClick={() => dialogue.current?.close()} className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/10">
            Fermer ✕
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
          onPointerDown={(e) => (departGlisser.current = e.clientX)}
          onPointerUp={(e) => {
            if (departGlisser.current === null) return;
            const dx = e.clientX - departGlisser.current;
            departGlisser.current = null;
            if (Math.abs(dx) > 50) aller(dx < 0 ? 1 : -1);
          }}
        >
          {/* Liens signés d'un bucket privé : pas d'optimisation next/image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url ?? undefined} alt={photo.legende ?? `Photo ${index + 1}`} className="max-h-full max-w-full select-none object-contain" draggable={false} />
          {photos.length > 1 && (
            <>
              <button type="button" onClick={() => aller(-1)} aria-label="Photo précédente" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-xl leading-none hover:bg-black/70">
                ‹
              </button>
              <button type="button" onClick={() => aller(1)} aria-label="Photo suivante" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 text-xl leading-none hover:bg-black/70">
                ›
              </button>
            </>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {lectureSeule ? (
            <p className="mx-auto max-w-3xl text-sm text-slate-200">{photo.legende || <span className="text-slate-400">Sans légende</span>}</p>
          ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enregistrerLegende();
            }}
            className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label htmlFor="legende" className="text-sm text-slate-300 sm:w-20">
              Légende
            </label>
            <input
              id="legende"
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              maxLength={200}
              placeholder="Facultatif, ex. « Salle de bain avant travaux »"
              className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white/50 focus:outline-none"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={enCours || legende === (photo.legende ?? "")} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-50">
                Enregistrer
              </button>
              {confirmerSuppression ? (
                <>
                  <button type="button" onClick={supprimer} disabled={enCours} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60">
                    Confirmer la suppression
                  </button>
                  <button type="button" onClick={() => setConfirmerSuppression(false)} className="rounded-md px-3 py-2 text-sm hover:bg-white/10">
                    Annuler
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmerSuppression(true)} className="rounded-md px-3 py-2 text-sm font-medium text-red-300 hover:bg-white/10">
                  Supprimer
                </button>
              )}
            </div>
          </form>
          )}
          {message && (
            <p role={message.type === "erreur" ? "alert" : "status"} className={`mx-auto mt-2 max-w-3xl text-sm ${message.type === "erreur" ? "text-red-300" : "text-green-300"}`}>
              {message.texte}
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
