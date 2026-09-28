"use client";

import { useRef, useState, useTransition } from "react";
import { BoutonsDialogue, Dialogue } from "@/components/Dialogue";
import { Alerte } from "@/components/formulaire";
import { formatDate, formatEuros } from "@/lib/format";
import { BadgeStatutTravail } from "@/components/Badges";
import { STATUTS_TRAVAIL, type Entreprise, type Travail } from "@/lib/travaux/types";
import { changerStatutTravail, supprimerTravail } from "@/app/(app)/travaux/actions";
import { FormulaireTravail } from "./FormulaireTravail";

type Props = {
  travaux: Travail[];
  logementId: string;
  vacanceId: string;
  entreprises: Entreprise[];
  estAdmin: boolean;
  /** Archives : aucune action, statuts affichés en badges. */
  lectureSeule?: boolean;
};

function SelectStatut({ travail, logementId, onErreur }: { travail: Travail; logementId: string; onErreur: (m?: string) => void }) {
  const [enCours, demarrer] = useTransition();
  const style = STATUTS_TRAVAIL.find((s) => s.code === travail.statut_code)?.badge ?? "";
  return (
    <select
      aria-label={`Statut de « ${travail.libelle} »`}
      value={travail.statut_code}
      disabled={enCours}
      onChange={(e) => {
        const statut = e.target.value;
        demarrer(async () => {
          const r = await changerStatutTravail(travail.id, logementId, statut);
          onErreur(r.erreur ? `« ${travail.libelle} » : ${r.erreur}` : undefined);
        });
      }}
      className={`rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium ring-1 ring-inset focus:ring-2 focus:ring-primaire disabled:opacity-60 ${style}`}
    >
      {STATUTS_TRAVAIL.map((s) => (
        <option key={s.code} value={s.code}>
          {s.libelle}
        </option>
      ))}
    </select>
  );
}

export function ListeTravaux({ travaux, logementId, vacanceId, entreprises, estAdmin, lectureSeule }: Props) {
  const [edition, setEdition] = useState<{ travail?: Travail } | null>(null);
  const [aSupprimer, setASupprimer] = useState<Travail | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [suppressionEnCours, demarrerSuppression] = useTransition();
  const dialogueSuppression = useRef<HTMLDialogElement>(null);

  const ouvrirSuppression = (t: Travail) => {
    setASupprimer(t);
    setErreur(undefined);
    dialogueSuppression.current?.showModal();
  };
  const confirmerSuppression = () =>
    aSupprimer &&
    demarrerSuppression(async () => {
      const r = await supprimerTravail(aSupprimer.id, logementId);
      if (r.erreur) setErreur(r.erreur);
      dialogueSuppression.current?.close();
    });

  const statut = (t: Travail) =>
    lectureSeule ? <BadgeStatutTravail code={t.statut_code} /> : <SelectStatut travail={t} logementId={logementId} onErreur={setErreur} />;

  const boutons = (t: Travail) =>
    lectureSeule ? null : (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={() => setEdition({ travail: t })} className="rounded px-2 py-1 text-sm font-medium text-primaire hover:bg-primaire-clair">
        Modifier
      </button>
      {estAdmin && (
        <button type="button" onClick={() => ouvrirSuppression(t)} className="rounded px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50">
          Supprimer
        </button>
      )}
    </div>
  );

  return (
    <section aria-labelledby="titre-travaux" className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 id="titre-travaux" className="text-base font-semibold text-slate-900">
          Travaux <span className="font-normal text-slate-500">({travaux.length})</span>
        </h2>
        {!lectureSeule && (
          <button type="button" onClick={() => setEdition({})} className="rounded-md bg-primaire px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce">
            + Ajouter un travail
          </button>
        )}
      </div>

      {erreur && (
        <div className="px-4 pt-4">
          <Alerte type="erreur">{erreur}</Alerte>
        </div>
      )}

      {travaux.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">
          {lectureSeule ? "Aucun travail pour cette vacance." : "Aucun travail pour cette vacance. Ajoutez le premier."}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th scope="col" className="px-4 py-2.5">Intitulé</th>
                  <th scope="col" className="px-3 py-2.5">Entreprise</th>
                  <th scope="col" className="px-3 py-2.5 whitespace-nowrap">Créé le</th>
                  <th scope="col" className="px-3 py-2.5 whitespace-nowrap">Commandé le</th>
                  <th scope="col" className="px-3 py-2.5 whitespace-nowrap">Fini le</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Montant HT</th>
                  <th scope="col" className="px-3 py-2.5">Statut</th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 border-t border-slate-200">
                {travaux.map((t) => (
                  <tr key={t.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{t.libelle}</p>
                      {t.description && <p className="mt-0.5 max-w-md whitespace-pre-line text-xs text-slate-500">{t.description}</p>}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{t.entreprise_nom ?? <span className="text-slate-400">Non attribuée</span>}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">{formatDate(t.created_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">{formatDate(t.date_commande)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-slate-700">{formatDate(t.date_fin_reelle)}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums text-slate-700">{formatEuros(t.montant_commande_ht)}</td>
                    <td className="px-3 py-2.5">{statut(t)}</td>
                    <td className="px-4 py-2">{boutons(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {travaux.map((t) => (
              <li key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-slate-900">{t.libelle}</p>
                  {statut(t)}
                </div>
                {t.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{t.description}</p>}
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  <dt>Entreprise</dt>
                  <dd className="text-slate-900">{t.entreprise_nom ?? "Non attribuée"}</dd>
                  <dt>Créé le</dt>
                  <dd className="text-slate-900">{formatDate(t.created_at)}</dd>
                  <dt>Commandé le</dt>
                  <dd className="text-slate-900">{formatDate(t.date_commande)}</dd>
                  <dt>Fini le</dt>
                  <dd className="text-slate-900">{formatDate(t.date_fin_reelle)}</dd>
                </dl>
                <div className="mt-2">{boutons(t)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {edition && (
        <FormulaireTravail
          key={edition.travail?.id ?? "nouveau"}
          travail={edition.travail}
          logementId={logementId}
          vacanceId={vacanceId}
          entreprises={entreprises}
          onFermer={() => setEdition(null)}
        />
      )}

      {!lectureSeule && (
      <Dialogue ref={dialogueSuppression} titre="Supprimer ce travail ?">
        <p className="text-sm text-slate-600">
          « {aSupprimer?.libelle} » sera supprimé de la fiche. La suppression reste tracée dans l&apos;historique du logement.
        </p>
        <BoutonsDialogue
          onAnnuler={() => dialogueSuppression.current?.close()}
          onConfirmer={confirmerSuppression}
          libelle="Supprimer"
          enCours={suppressionEnCours}
          danger
        />
      </Dialogue>
      )}
    </section>
  );
}
