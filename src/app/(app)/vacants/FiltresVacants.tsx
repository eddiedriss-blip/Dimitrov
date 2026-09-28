"use client";

import { useState, type ReactNode } from "react";
import { AnnonceChargement, BoutonReinitialiser, classeChamp, Libelle, useFiltresUrl } from "@/components/filtres";
import { nbFiltresActifs, type EtatListe, type ParamFiltre } from "@/lib/logements/recherche";
import { avecEtat, STATUTS_LOGEMENT, STATUTS_TRAVAUX, type Referentiels } from "@/lib/logements/types";

const FILTRES_AVANCES: ParamFiltre[] = [
  "groupe", "reservataire", "plafond", "type", "etage", "surface_min", "surface_max",
  "lc_min", "lc_max", "preavis_du", "preavis_au", "envoi_du", "envoi_au", "reprise_du", "reprise_au",
];

export function FiltresVacants({ etat, referentiels }: { etat: EtatListe; referentiels: Referentiels }) {
  const { valeurs: v, modifier, reinitialiser, enCours } = useFiltresUrl(etat);

  const nbAvances = FILTRES_AVANCES.filter((c) => etat.filtres[c]).length + (etat.loues ? 1 : 0);
  const [ouvert, setOuvert] = useState(nbAvances > 0);

  const texte = (nom: ParamFiltre | "q", type: "text" | "number" | "date" | "search", props: Record<string, unknown> = {}) => (
    <input
      id={`f-${nom}`}
      type={type}
      value={v[nom] ?? ""}
      onChange={(e) => modifier(nom, e.target.value, type === "date")}
      className={classeChamp}
      {...props}
    />
  );

  const liste = (nom: ParamFiltre, options: { valeur: string; libelle: string }[], tous = "Tous") => (
    <select id={`f-${nom}`} value={v[nom] ?? ""} onChange={(e) => modifier(nom, e.target.value, true)} className={classeChamp}>
      <option value="">{tous}</option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
    </select>
  );

  const actifs = nbFiltresActifs(etat);

  return (
    <section aria-label="Recherche et filtres" className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Libelle htmlFor="f-q">Recherche générale</Libelle>
          {texte("q", "search", { placeholder: "N° ESI, groupe, réservataire, ancien locataire, commentaire…", maxLength: 100 })}
        </div>
        <div>
          <Libelle htmlFor="f-statut">Statut du logement</Libelle>
          {liste("statut", STATUTS_LOGEMENT.map((s) => ({ valeur: s.code, libelle: s.libelle })))}
        </div>
        <div>
          <Libelle htmlFor="f-travaux">Statut des travaux</Libelle>
          {liste("travaux", STATUTS_TRAVAUX.map((s) => ({ valeur: s.code, libelle: s.libelle })))}
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-controls="filtres-avances"
            className="whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {ouvert ? "Moins de filtres" : "Plus de filtres"}
            {nbAvances > 0 && (
              <span className="ml-1.5 rounded-full bg-primaire px-1.5 py-0.5 text-xs text-white">{nbAvances}</span>
            )}
          </button>
          <BoutonReinitialiser onClick={reinitialiser} desactive={actifs === 0} />
        </div>
      </div>

      <div id="filtres-avances" hidden={!ouvert} className="mt-4 border-t border-slate-200 pt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Libelle htmlFor="f-groupe">Groupe</Libelle>
            {liste("groupe", referentiels.groupes.map((g) => ({ valeur: g.id, libelle: avecEtat(`${g.nom} (${g.code})`, g.actif) })))}
          </div>
          <div>
            <Libelle htmlFor="f-reservataire">Réservataire</Libelle>
            {liste("reservataire", [
              { valeur: "aucun", libelle: "Sans réservataire" },
              ...referentiels.reservataires.map((r) => ({ valeur: r.id, libelle: avecEtat(r.nom, r.actif) })),
            ])}
          </div>
          <div>
            <Libelle htmlFor="f-plafond">Plafond</Libelle>
            {liste("plafond", referentiels.plafonds.map((p) => ({ valeur: p.code, libelle: avecEtat(p.code, p.actif) })))}
          </div>
          <div>
            <Libelle htmlFor="f-type">Type de logement</Libelle>
            {liste("type", referentiels.types.map((t) => ({ valeur: t.code, libelle: avecEtat(t.libelle, t.actif) })))}
          </div>
          <div>
            <Libelle htmlFor="f-etage">Étage (0 = RDC)</Libelle>
            {texte("etage", "number", { step: 1, inputMode: "numeric" })}
          </div>
          <Intervalle titre="Surface (m²)" min="surface_min" max="surface_max" rendu={texte} />
          <Intervalle titre="Loyer + charges (€)" min="lc_min" max="lc_max" rendu={texte} />
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={v.loues === "1"}
                onChange={(e) => modifier("loues", e.target.checked ? "1" : "", true)}
                className="h-4 w-4 rounded border-slate-300 accent-primaire"
              />
              Inclure les logements loués (archivés)
            </label>
          </div>
          <Periode titre="Préavis reçu" du="preavis_du" au="preavis_au" rendu={texte} />
          <Periode titre="Envoi au réservataire" du="envoi_du" au="envoi_au" rendu={texte} />
          <Periode titre="Date de reprise" du="reprise_du" au="reprise_au" rendu={texte} />
        </div>
      </div>

      <AnnonceChargement enCours={enCours} />
    </section>
  );
}

type Rendu = (nom: ParamFiltre, type: "number" | "date", props?: Record<string, unknown>) => ReactNode;

function Intervalle({ titre, min, max, rendu }: { titre: string; min: ParamFiltre; max: ParamFiltre; rendu: Rendu }) {
  return (
    <fieldset>
      <legend className="mb-1 block text-xs font-medium text-slate-600">{titre}</legend>
      <div className="grid grid-cols-2 gap-2">
        {rendu(min, "number", { min: 0, step: "any", placeholder: "min", "aria-label": `${titre} minimum` })}
        {rendu(max, "number", { min: 0, step: "any", placeholder: "max", "aria-label": `${titre} maximum` })}
      </div>
    </fieldset>
  );
}

function Periode({ titre, du, au, rendu }: { titre: string; du: ParamFiltre; au: ParamFiltre; rendu: Rendu }) {
  return (
    <fieldset className="sm:col-span-2 lg:col-span-1">
      <legend className="mb-1 block text-xs font-medium text-slate-600">{titre}</legend>
      <div className="grid grid-cols-2 gap-2">
        {rendu(du, "date", { "aria-label": `${titre} : du` })}
        {rendu(au, "date", { "aria-label": `${titre} : au` })}
      </div>
    </fieldset>
  );
}
