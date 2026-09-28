"use client";

import { useRef, useState, useTransition } from "react";
import { passerALouer } from "@/app/(app)/vacants/actions";
import { BoutonsDialogue, Dialogue } from "@/components/Dialogue";

/** « Travaux finis » → « À louer », avec confirmation. */
export function BoutonALouer({ id, numeroEsi, variante = "bouton" }: { id: string; numeroEsi: string; variante?: "bouton" | "lien" }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  const confirmer = () =>
    demarrer(async () => {
      const r = await passerALouer(id);
      if (r.erreur) {
        setErreur(r.erreur);
        return;
      }
      dialogue.current?.close();
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
            ? "rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
            : "whitespace-nowrap rounded px-1.5 py-1 text-sm font-medium text-violet-700 hover:bg-violet-50"
        }
      >
        Passer à louer
      </button>
      <Dialogue ref={dialogue} titre={`Mettre le logement ${numeroEsi} à louer ?`}>
        <p className="text-sm text-slate-600">
          Le statut passera de <strong>Travaux finis</strong> à <strong>À louer</strong>. Ce statut n&apos;est plus modifié
          automatiquement par les travaux.
        </p>
        {erreur && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <BoutonsDialogue onAnnuler={() => dialogue.current?.close()} onConfirmer={confirmer} libelle="Passer à louer" enCours={enCours} />
      </Dialogue>
    </>
  );
}
