"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { archiverLogement } from "./actions";

/** Bouton « Archiver » avec fenêtre de confirmation (passage au statut Loué). */
export function BoutonArchiver({
  id,
  numeroEsi,
  retour,
  variante = "lien",
}: {
  id: string;
  numeroEsi: string;
  retour?: string;
  variante?: "lien" | "bouton";
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  const confirmer = () =>
    demarrer(async () => {
      const resultat = await archiverLogement(id, retour);
      if (resultat?.erreur) {
        setErreur(resultat.erreur);
        return;
      }
      dialogue.current?.close();
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErreur(undefined);
          dialogue.current?.showModal();
        }}
        className={
          variante === "bouton"
            ? "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            : "rounded px-1.5 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }
      >
        Archiver
      </button>

      <dialog
        ref={dialogue}
        aria-labelledby={`archiver-titre-${id}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="p-6">
          <h2 id={`archiver-titre-${id}`} className="text-lg font-semibold text-slate-900">
            Archiver le logement {numeroEsi} ?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Le logement passera au statut <strong>Loué</strong> et la vacance en cours sera clôturée à la date
            d&apos;aujourd&apos;hui. Il restera consultable dans les Archives.
          </p>
          {erreur && (
            <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogue.current?.close()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmer}
              disabled={enCours}
              className="rounded-md bg-primaire px-4 py-2 text-sm font-semibold text-white hover:bg-primaire-fonce disabled:opacity-70"
            >
              {enCours ? "Archivage…" : "Archiver"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
