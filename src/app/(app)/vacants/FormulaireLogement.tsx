"use client";

import Link from "next/link";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { Alerte, classeChampFormulaire } from "@/components/formulaire";
import { formatEuros } from "@/lib/format";
import { codeGroupeEsi, porteEsi } from "@/lib/logements/esi";
import { avecEtat, STATUTS_LOGEMENT, type LigneLogement, type Referentiels } from "@/lib/logements/types";
import { enregistrerLogement } from "./actions";


/** Valeurs initiales du formulaire (tous les champs en texte, comme dans le FormData). */
function valeursInitiales(l?: LigneLogement | null): Record<string, string> {
  const t = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    numero_esi: t(l?.numero_esi),
    reservataire_id: t(l?.reservataire_id),
    plafond_code: t(l?.plafond_code),
    type_logement_code: t(l?.type_logement_code),
    statut_code: t(l?.statut_code ?? "vacant_technique"),
    adresse: t(l?.adresse),
    batiment: t(l?.batiment),
    escalier: t(l?.escalier),
    etage: t(l?.etage),
    surface_habitable: t(l?.surface_habitable),
    loyer: t(l?.loyer),
    charges: t(l?.charges),
    commentaire: t(l?.commentaire),
    nom_ancien_locataire: t(l?.nom_ancien_locataire),
    date_liberation: t(l?.date_liberation),
    date_preavis: t(l?.date_preavis),
    date_envoi_reservataire: t(l?.date_envoi_reservataire),
    date_reprise: t(l?.date_reprise),
  };
}

export function FormulaireLogement({
  logement,
  referentiels,
  vue,
}: {
  logement?: LigneLogement | null;
  referentiels: Referentiels;
  /** « telephone » : retour à l'écran Téléphone après l'enregistrement. */
  vue?: "telephone";
}) {
  const accueil = vue === "telephone" ? "/telephone" : "/vacants";
  const [etat, action, enCours] = useActionState(enregistrerLogement, undefined);
  const initiales = valeursInitiales(logement);
  const v = etat?.champs ?? initiales;
  const erreurs = etat?.erreursChamps ?? {};

  const formulaire = useRef<HTMLFormElement>(null);
  const dialogue = useRef<HTMLDialogElement>(null);
  const confirme = useRef(false);
  const [loyer, setLoyer] = useState(v.loyer);
  const [charges, setCharges] = useState(v.charges);
  const [nouveauStatut, setNouveauStatut] = useState("");
  const [esi, setEsi] = useState(v.numero_esi);

  // React réinitialise le formulaire après chaque envoi, mais ne réapplique pas la valeur
  // par défaut des <select> : on reconstruit donc le formulaire à chaque réponse du serveur.
  const [reponse, setReponse] = useState(etat);
  const [version, setVersion] = useState(0);
  if (etat !== reponse) {
    setReponse(etat);
    setVersion(version + 1);
  }

  const total = (() => {
    const a = Number(loyer.replace(",", "."));
    const b = Number(charges.replace(",", "."));
    return loyer && charges && Number.isFinite(a) && Number.isFinite(b) ? formatEuros(a + b) : "—";
  })();

  // Changement manuel du statut d'un logement existant : confirmation avant l'envoi.
  // Groupe déduit des 5 premiers chiffres du N° ESI (même règle que la base).
  const codeGroupe = codeGroupeEsi(esi);
  const groupe = codeGroupe ? referentiels.groupes.find((g) => g.code === codeGroupe) : undefined;
  const groupeDeduit = !codeGroupe
    ? "—"
    : groupe
      ? avecEtat(`${groupe.nom} (${groupe.code})`, groupe.actif)
      : `Nouveau groupe ${codeGroupe} (créé à l'enregistrement, à nommer dans Paramètres)`;

  const surEnvoi = (e: React.FormEvent<HTMLFormElement>) => {
    const statut = new FormData(e.currentTarget).get("statut_code");
    if (logement && statut !== logement.statut_code && !confirme.current) {
      e.preventDefault();
      setNouveauStatut(STATUTS_LOGEMENT.find((s) => s.code === statut)?.libelle ?? String(statut));
      dialogue.current?.showModal();
    }
    confirme.current = false;
  };

  const champ = (nom: string, libelle: string, props: Record<string, unknown> = {}, aide?: ReactNode) => (
    <div>
      <label htmlFor={nom} className="mb-1 block text-sm font-medium text-slate-700">
        {libelle}
        {props.required ? <span className="text-red-600"> *</span> : null}
      </label>
      <input
        id={nom}
        name={nom}
        defaultValue={v[nom]}
        aria-invalid={erreurs[nom] ? true : undefined}
        aria-describedby={erreurs[nom] ? `${nom}-erreur` : undefined}
        className={classeChampFormulaire}
        {...props}
      />
      {erreurs[nom] ? (
        <p id={`${nom}-erreur`} className="mt-1 text-xs text-red-700">
          {erreurs[nom]}
        </p>
      ) : (
        aide && <p className="mt-1 text-xs text-slate-500">{aide}</p>
      )}
    </div>
  );

  const liste = (nom: string, libelle: string, options: { valeur: string; libelle: string }[], vide: string | null, required = false) => (
    <div>
      <label htmlFor={nom} className="mb-1 block text-sm font-medium text-slate-700">
        {libelle}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <select
        id={nom}
        name={nom}
        defaultValue={v[nom]}
        required={required}
        aria-invalid={erreurs[nom] ? true : undefined}
        className={classeChampFormulaire}
      >
        {vide !== null && <option value="">{vide}</option>}
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      {erreurs[nom] && <p className="mt-1 text-xs text-red-700">{erreurs[nom]}</p>}
    </div>
  );

  return (
    <form key={version} ref={formulaire} action={action} onSubmit={surEnvoi} noValidate className="space-y-8">
      {logement && <input type="hidden" name="id" value={logement.id} />}
      {vue && <input type="hidden" name="vue" value={vue} />}
      {etat?.erreur && <Alerte type="erreur">{etat.erreur}</Alerte>}

      <Section titre="Logement">
        {champ(
          "numero_esi",
          "N° ESI",
          {
            required: true,
            maxLength: 14,
            autoComplete: "off",
            placeholder: "12345L0012",
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEsi(e.target.value),
          },
          "5 chiffres (groupe), la lettre L, puis 4 chiffres (n° de porte).",
        )}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Groupe</span>
          <output htmlFor="numero_esi" className="block rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900">
            {groupeDeduit}
          </output>
          <p className="mt-1 text-xs text-slate-500">Déduit des 5 premiers chiffres du N° ESI (la porte, des 4 derniers).</p>
        </div>
        {liste("type_logement_code", "Type de logement", referentiels.types.filter((t) => t.actif || t.code === initiales.type_logement_code).map((t) => ({ valeur: t.code, libelle: avecEtat(t.libelle, t.actif) })), "Choisir…", true)}
        {liste("statut_code", "Statut du logement", STATUTS_LOGEMENT.map((s) => ({ valeur: s.code, libelle: s.libelle })), null)}
        {liste("reservataire_id", "Réservataire", referentiels.reservataires.filter((r) => r.actif || r.id === initiales.reservataire_id).map((r) => ({ valeur: r.id, libelle: avecEtat(r.nom, r.actif) })), "Aucun")}
        {liste("plafond_code", "Plafond", referentiels.plafonds.filter((p) => p.actif || p.code === initiales.plafond_code).map((p) => ({ valeur: p.code, libelle: avecEtat(p.libelle, p.actif) })), "Non renseigné")}
        {champ("adresse", "Adresse", { maxLength: 200 })}
        <div className="grid grid-cols-3 gap-3">
          {champ("batiment", "Bâtiment", { maxLength: 20 })}
          {champ("escalier", "Escalier", { maxLength: 20 })}
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Porte</span>
            <output htmlFor="numero_esi" className="block rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {porteEsi(esi) ?? "—"}
            </output>
          </div>
        </div>
        {champ("etage", "Étage", { type: "number", step: 1, inputMode: "numeric" }, "0 = rez-de-chaussée")}
        {champ("surface_habitable", "Surface habitable (m²)", { type: "number", min: 0, step: "0.01", inputMode: "decimal" })}
      </Section>

      <Section titre="Loyer">
        {champ("loyer", "Loyer (€)", { type: "number", min: 0, step: "0.01", inputMode: "decimal", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLoyer(e.target.value) })}
        {champ("charges", "Charges (€)", { type: "number", min: 0, step: "0.01", inputMode: "decimal", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCharges(e.target.value) })}
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Loyer + charges</span>
          <output htmlFor="loyer charges" className="block rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
            {total}
          </output>
          <p className="mt-1 text-xs text-slate-500">Calculé automatiquement.</p>
        </div>
      </Section>

      <Section titre={logement?.archive ? "Dernière vacance" : "Vacance en cours"}>
        {champ("nom_ancien_locataire", "Nom de l'ancien locataire", { maxLength: 120, autoComplete: "off" })}
        {champ("date_preavis", "Préavis reçu le", { type: "date" })}
        {champ("date_liberation", "Date de libération", { type: "date" }, logement ? "Début de la vacance" : "Laisser vide = aujourd'hui")}
        {champ("date_envoi_reservataire", "Envoi au réservataire le", { type: "date" })}
        {champ("date_reprise", "Date de reprise", { type: "date" }, "Remise en location prévue")}
      </Section>

      <Section titre="Commentaire" pleine>
        <textarea
          id="commentaire"
          name="commentaire"
          aria-label="Commentaire"
          defaultValue={v.commentaire}
          rows={3}
          maxLength={2000}
          className={classeChampFormulaire}
        />
      </Section>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
        <Link
          href={logement ? `${accueil}/${logement.id}` : accueil}
          className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-md bg-primaire px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce disabled:cursor-wait disabled:opacity-70"
        >
          {enCours ? "Enregistrement…" : logement ? "Enregistrer les modifications" : "Créer le logement"}
        </button>
      </div>

      <dialog ref={dialogue} aria-labelledby="statut-titre" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-0 shadow-xl backdrop:bg-slate-900/40">
        <div className="p-6">
          <h2 id="statut-titre" className="text-lg font-semibold text-slate-900">
            Changer le statut du logement ?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Le statut passera de <strong>{logement?.statut_libelle}</strong> à <strong>{nouveauStatut}</strong>. Ce
            changement sera enregistré dans l&apos;historique du logement.
          </p>
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
              onClick={() => {
                confirme.current = true;
                dialogue.current?.close();
                formulaire.current?.requestSubmit();
              }}
              className="rounded-md bg-primaire px-4 py-2 text-sm font-semibold text-white hover:bg-primaire-fonce"
            >
              Confirmer
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}

function Section({ titre, children, pleine }: { titre: string; children: ReactNode; pleine?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-4 text-base font-semibold text-slate-900">{titre}</legend>
      <div className={pleine ? "" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{children}</div>
    </fieldset>
  );
}
