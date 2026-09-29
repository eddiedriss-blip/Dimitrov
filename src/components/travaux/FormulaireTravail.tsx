"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Alerte, classeChampFormulaire } from "@/components/formulaire";
import { Dialogue } from "@/components/Dialogue";
import { envoyerSansReinitialiser } from "@/lib/formulaires";
import { formatDate } from "@/lib/format";
import { NOUVELLE_ENTREPRISE, STATUTS_TRAVAIL, type Entreprise, type Travail } from "@/lib/travaux/types";
import { enregistrerTravail } from "@/app/(app)/travaux/actions";


/**
 * Ajout / modification d'un travail dans une fenêtre modale.
 * Champs contrôlés : la réinitialisation automatique du formulaire par React après l'envoi
 * ne fait donc pas perdre la saisie en cas d'erreur.
 */
export function FormulaireTravail({
  travail,
  logementId,
  vacanceId,
  entreprises,
  onFermer,
}: {
  travail?: Travail;
  logementId: string;
  vacanceId: string;
  entreprises: Entreprise[];
  onFermer: () => void;
}) {
  const dialogue = useRef<HTMLDialogElement>(null);
  const [etat, action, enCours] = useActionState(enregistrerTravail, undefined);
  const [v, setV] = useState({
    libelle: travail?.libelle ?? "",
    description: travail?.description ?? "",
    entreprise_id: travail?.entreprise_id ?? "",
    nouvelle_entreprise: "",
    statut_code: travail?.statut_code ?? "a_commander",
    date_commande: travail?.date_commande ?? "",
    date_fin_reelle: travail?.date_fin_reelle ?? "",
    montant_commande_ht: travail?.montant_commande_ht?.toString() ?? "",
  });
  const maj = (cle: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [cle]: e.target.value }));
  const erreurs = etat?.erreursChamps ?? {};

  useEffect(() => {
    dialogue.current?.showModal();
  }, []);
  useEffect(() => {
    if (etat?.ok) dialogue.current?.close();
  }, [etat]);

  const champ = (nom: string, libelle: string, controle: ReactNode, aide?: string) => (
    <div>
      <label htmlFor={`t-${nom}`} className="mb-1 block text-sm font-medium text-slate-700">
        {libelle}
      </label>
      {controle}
      {erreurs[nom] ? <p className="mt-1 text-xs text-red-700">{erreurs[nom]}</p> : aide && <p className="mt-1 text-xs text-slate-500">{aide}</p>}
    </div>
  );

  return (
    <Dialogue ref={dialogue} titre={travail ? "Modifier le travail" : "Ajouter un travail"} large onClose={onFermer}>
      <form onSubmit={envoyerSansReinitialiser(action)} noValidate className="space-y-4">
        {travail && <input type="hidden" name="id" value={travail.id} />}
        <input type="hidden" name="logement_id" value={logementId} />
        <input type="hidden" name="vacance_id" value={vacanceId} />
        {etat?.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}

        {champ(
          "libelle",
          "Intitulé *",
          <input id="t-libelle" name="libelle" value={v.libelle} onChange={maj("libelle")} maxLength={200} required autoFocus aria-invalid={!!erreurs.libelle || undefined} className={classeChampFormulaire} />,
        )}
        {champ(
          "description",
          "Commentaire",
          <textarea id="t-description" name="description" value={v.description} onChange={maj("description")} rows={3} maxLength={2000} className={classeChampFormulaire} />,
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {champ(
            "entreprise_id",
            "Entreprise",
            <select id="t-entreprise_id" name="entreprise_id" value={v.entreprise_id} onChange={maj("entreprise_id")} aria-invalid={!!erreurs.entreprise_id || undefined} className={classeChampFormulaire}>
              <option value="">Non attribuée</option>
              {entreprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.raison_sociale}
                </option>
              ))}
              {travail?.entreprise_id && !entreprises.some((e) => e.id === travail.entreprise_id) && (
                <option value={travail.entreprise_id}>{travail.entreprise_nom} (désactivée)</option>
              )}
              <option value={NOUVELLE_ENTREPRISE}>+ Nouvelle entreprise…</option>
            </select>,
          )}
          {champ(
            "statut_code",
            "Statut",
            <select id="t-statut_code" name="statut_code" value={v.statut_code} onChange={maj("statut_code")} className={classeChampFormulaire}>
              {STATUTS_TRAVAIL.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.libelle}
                </option>
              ))}
            </select>,
          )}
        </div>

        {v.entreprise_id === NOUVELLE_ENTREPRISE &&
          champ(
            "nouvelle_entreprise",
            "Nom de la nouvelle entreprise *",
            <input id="t-nouvelle_entreprise" name="nouvelle_entreprise" value={v.nouvelle_entreprise} onChange={maj("nouvelle_entreprise")} maxLength={200} aria-invalid={!!erreurs.nouvelle_entreprise || undefined} className={classeChampFormulaire} />,
            "Elle sera ajoutée à la liste des entreprises.",
          )}

        <div className="grid gap-4 sm:grid-cols-3">
          {champ(
            "date_commande",
            "Commandé le",
            <input id="t-date_commande" name="date_commande" type="date" value={v.date_commande} onChange={maj("date_commande")} className={classeChampFormulaire} />,
            "Automatique au passage à « Commandé »",
          )}
          {champ(
            "date_fin_reelle",
            "Fini le",
            <input id="t-date_fin_reelle" name="date_fin_reelle" type="date" value={v.date_fin_reelle} onChange={maj("date_fin_reelle")} className={classeChampFormulaire} />,
            "Automatique au passage à « Fini »",
          )}
          {champ(
            "montant_commande_ht",
            "Montant HT (€)",
            <input id="t-montant_commande_ht" name="montant_commande_ht" type="number" min={0} step="0.01" inputMode="decimal" value={v.montant_commande_ht} onChange={maj("montant_commande_ht")} className={classeChampFormulaire} />,
            "Facultatif (servira aux Chiffres)",
          )}
        </div>

        {travail && <p className="text-xs text-slate-500">Créé le {formatDate(travail.created_at)}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => dialogue.current?.close()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button type="submit" disabled={enCours} className="rounded-md bg-primaire px-4 py-2 text-sm font-semibold text-white hover:bg-primaire-fonce disabled:opacity-70">
            {enCours ? "Enregistrement…" : travail ? "Enregistrer" : "Ajouter le travail"}
          </button>
        </div>
      </form>
    </Dialogue>
  );
}
