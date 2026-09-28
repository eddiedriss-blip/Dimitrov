"use client";

import { useId, type ReactNode, type Ref } from "react";

/** Fenêtre modale native (<dialog>) : focus piégé, Échap pour fermer, fond assombri. */
export function Dialogue({
  ref,
  titre,
  children,
  large,
  onClose,
}: {
  ref: Ref<HTMLDialogElement>;
  titre: string;
  children: ReactNode;
  large?: boolean;
  onClose?: () => void;
}) {
  const id = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      className={`m-auto w-[calc(100%-2rem)] rounded-lg p-0 shadow-xl backdrop:bg-slate-900/40 ${large ? "max-w-2xl" : "max-w-md"}`}
    >
      <div className="p-6">
        <h2 id={id} className="text-lg font-semibold text-slate-900">
          {titre}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}

export function BoutonsDialogue({
  onAnnuler,
  onConfirmer,
  libelle,
  enCours,
  danger,
  type = "button",
}: {
  onAnnuler: () => void;
  onConfirmer?: () => void;
  libelle: string;
  enCours?: boolean;
  danger?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onAnnuler}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Annuler
      </button>
      <button
        type={type}
        onClick={onConfirmer}
        disabled={enCours}
        className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-70 ${
          danger ? "bg-red-600 hover:bg-red-700" : "bg-primaire hover:bg-primaire-fonce"
        }`}
      >
        {enCours ? "Patientez…" : libelle}
      </button>
    </div>
  );
}
