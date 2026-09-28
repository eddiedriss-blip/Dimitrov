"use client";

import { AnnonceChargement, BoutonReinitialiser, classeChamp, Libelle, useFiltresUrl } from "@/components/filtres";
import { nbFiltresActifs, type EtatListe, type ParamFiltre } from "@/lib/logements/recherche";
import { avecEtat, type Referentiels } from "@/lib/logements/types";

export function FiltresArchives({ etat, referentiels }: { etat: EtatListe; referentiels: Referentiels }) {
  const { valeurs: v, modifier, reinitialiser, enCours } = useFiltresUrl(etat);

  const liste = (nom: ParamFiltre, options: { valeur: string; libelle: string }[]) => (
    <select id={`f-${nom}`} value={v[nom] ?? ""} onChange={(e) => modifier(nom, e.target.value, true)} className={classeChamp}>
      <option value="">Tous</option>
      {options.map((o) => (
        <option key={o.valeur} value={o.valeur}>
          {o.libelle}
        </option>
      ))}
    </select>
  );

  return (
    <section aria-label="Recherche et filtres" className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Libelle htmlFor="f-q">Recherche générale</Libelle>
          <input
            id="f-q"
            type="search"
            value={v.q ?? ""}
            onChange={(e) => modifier("q", e.target.value)}
            placeholder="N° ESI, groupe, réservataire, ancien locataire, commentaire…"
            maxLength={100}
            className={classeChamp}
          />
        </div>
        <div>
          <Libelle htmlFor="f-groupe">Groupe</Libelle>
          {liste("groupe", referentiels.groupes.map((g) => ({ valeur: g.id, libelle: avecEtat(`${g.nom} (${g.code})`, g.actif) })))}
        </div>
        <div>
          <Libelle htmlFor="f-reservataire">Réservataire</Libelle>
          {liste("reservataire", [{ valeur: "aucun", libelle: "Sans réservataire" }, ...referentiels.reservataires.map((r) => ({ valeur: r.id, libelle: avecEtat(r.nom, r.actif) }))])}
        </div>
        <div>
          <Libelle htmlFor="f-type">Type</Libelle>
          {liste("type", referentiels.types.map((t) => ({ valeur: t.code, libelle: avecEtat(t.libelle, t.actif) })))}
        </div>
        <fieldset className="sm:col-span-2 lg:col-span-1">
          <legend className="mb-1 block text-xs font-medium text-slate-600">Loué entre le</legend>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="Loué à partir du" value={v.loue_du ?? ""} onChange={(e) => modifier("loue_du", e.target.value, true)} className={classeChamp} />
            <input type="date" aria-label="Loué jusqu'au" value={v.loue_au ?? ""} onChange={(e) => modifier("loue_au", e.target.value, true)} className={classeChamp} />
          </div>
        </fieldset>
        <div className="flex items-end">
          <BoutonReinitialiser onClick={reinitialiser} desactive={nbFiltresActifs(etat) === 0} />
        </div>
      </div>
      <AnnonceChargement enCours={enCours} />
    </section>
  );
}
