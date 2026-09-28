"use client";

import { useRef, useState, useTransition } from "react";
import { BoutonsDialogue, Dialogue } from "@/components/Dialogue";
import { STATUTS_LOGEMENT, type CodeStatutLogement } from "@/lib/logements/types";
import { changerStatutLogement } from "../actions";

/** Modification manuelle du statut du logement, avec confirmation. */
export function StatutLogementManuel({ logementId, statut }: { logementId: string; statut: CodeStatutLogement }) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [choix, setChoix] = useState<string>(statut);
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  // Le statut peut aussi changer automatiquement (travaux) : on suit la valeur du serveur.
  const [vu, setVu] = useState(statut);
  if (vu !== statut) {
    setVu(statut);
    setChoix(statut);
  }

  const libelle = (code: string) => STATUTS_LOGEMENT.find((s) => s.code === code)?.libelle ?? code;

  const confirmer = () =>
    demarrer(async () => {
      const r = await changerStatutLogement(logementId, choix);
      if (r.erreur) {
        setErreur(r.erreur);
        return;
      }
      dialogue.current?.close();
    });

  return (
    <div>
      <label htmlFor="statut-logement" className="mb-1 block text-xs font-medium text-slate-500">
        Statut du logement
      </label>
      <select
        id="statut-logement"
        value={choix}
        onChange={(e) => {
          setChoix(e.target.value);
          setErreur(undefined);
          dialogue.current?.showModal();
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-primaire focus:ring-2 focus:ring-primaire/25"
      >
        {STATUTS_LOGEMENT.map((s) => (
          <option key={s.code} value={s.code}>
            {s.libelle}
          </option>
        ))}
      </select>

      <Dialogue ref={dialogue} titre="Modifier le statut du logement ?" onClose={() => !enCours && setChoix(statut)}>
        <p className="text-sm text-slate-600">
          Le statut passera de <strong>{libelle(statut)}</strong> à <strong>{libelle(choix)}</strong>.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Ce statut est normalement mis à jour automatiquement selon l&apos;avancement des travaux ; il sera recalculé au
          prochain changement sur un travail (sauf « À louer » et « Loué », jamais modifiés automatiquement).
        </p>
        {erreur && (
          <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <BoutonsDialogue onAnnuler={() => dialogue.current?.close()} onConfirmer={confirmer} libelle="Confirmer" enCours={enCours} />
      </Dialogue>
    </div>
  );
}
