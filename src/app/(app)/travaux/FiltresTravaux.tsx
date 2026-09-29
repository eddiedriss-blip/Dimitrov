"use client";

import { AnnonceChargement, BoutonReinitialiser, classeChamp, Libelle, useFiltresUrl } from "@/components/filtres";
import { nbFiltresActifs, type EtatListe, type ParamFiltre } from "@/lib/logements/recherche";
import { avecEtat, STATUTS_LOGEMENT, type Referentiels } from "@/lib/logements/types";

export function FiltresTravaux({ etat, referentiels }: { etat: EtatListe; referentiels: Referentiels }) {
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
    <section aria-label="Filtres" className="mb-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <div>
          <Libelle htmlFor="f-esi">N° ESI</Libelle>
          <input
            id="f-esi"
            type="search"
            value={v.esi ?? ""}
            onChange={(e) => modifier("esi", e.target.value)}
            placeholder="ex. 12345L0012"
            maxLength={30}
            className={classeChamp}
          />
        </div>
        <div>
          <Libelle htmlFor="f-groupe">Groupe</Libelle>
          {liste("groupe", referentiels.groupes.map((g) => ({ valeur: g.id, libelle: avecEtat(`${g.nom} (${g.code})`, g.actif) })))}
        </div>
        <div>
          <Libelle htmlFor="f-etage">Étage (0 = RDC)</Libelle>
          <input
            id="f-etage"
            type="number"
            step={1}
            inputMode="numeric"
            value={v.etage ?? ""}
            onChange={(e) => modifier("etage", e.target.value)}
            className={classeChamp}
          />
        </div>
        <div>
          <Libelle htmlFor="f-type">Type</Libelle>
          {liste("type", referentiels.types.map((t) => ({ valeur: t.code, libelle: avecEtat(t.libelle, t.actif) })))}
        </div>
        <div>
          <Libelle htmlFor="f-statut">Statut du logement</Libelle>
          {liste("statut", STATUTS_LOGEMENT.map((s) => ({ valeur: s.code, libelle: s.libelle })))}
        </div>
        <div className="flex items-end">
          <BoutonReinitialiser onClick={reinitialiser} desactive={nbFiltresActifs(etat) === 0} />
        </div>
      </div>
      <AnnonceChargement enCours={enCours} />
    </section>
  );
}
