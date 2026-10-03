import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeStatutLogement, BadgeStatutTravaux } from "@/components/Badges";
import { formatDate, formatEtage, formatEuros, formatSurface } from "@/lib/format";
import { type CleTri, type EtatListe } from "@/lib/logements/recherche";
import type { CodeStatutLogement, LigneLogement } from "@/lib/logements/types";
import { BoutonALouer } from "@/components/BoutonALouer";
import { EnTeteColonne } from "@/components/EnTeteColonne";
import { BoutonArchiver } from "./BoutonArchiver";

type Colonne = {
  /** Absent : colonne non triable. */
  tri?: CleTri;
  libelle: string;
  nombre?: boolean;
  cellule: (l: LigneLogement) => ReactNode;
};

/** Fond de ligne selon le statut du logement (classes complètes pour Tailwind). Autres statuts : blanc. */
const FONDS: Partial<Record<CodeStatutLogement, { fond: string; lisere: string }>> = {
  vacant_technique: { fond: "bg-red-100 group-hover:bg-red-200", lisere: "border-l-red-500" },
  travaux_a_faire: { fond: "bg-orange-100 group-hover:bg-orange-200", lisere: "border-l-orange-500" },
  travaux_commandes: { fond: "bg-yellow-100 group-hover:bg-yellow-200", lisere: "border-l-yellow-500" },
  travaux_finis: { fond: "bg-green-100 group-hover:bg-green-200", lisere: "border-l-green-600" },
};
const fondLigne = (l: LigneLogement) => FONDS[l.statut_code] ?? { fond: "bg-white group-hover:bg-slate-50", lisere: "border-l-transparent" };

const COLONNES: Colonne[] = [
  { libelle: "Porte", nombre: true, cellule: (l) => l.porte ?? "—" },
  { tri: "groupe", libelle: "Groupe", cellule: (l) => <span title={l.groupe_code}>{l.groupe_nom}</span> },
  { tri: "reservataire", libelle: "Réservataire", cellule: (l) => l.reservataire_nom ?? "—" },
  { tri: "envoi", libelle: "Envoi au réservataire", cellule: (l) => formatDate(l.date_envoi_reservataire) },
  { tri: "reprise", libelle: "Date de reprise", cellule: (l) => formatDate(l.date_reprise) },
  { tri: "plafond", libelle: "Plafond", cellule: (l) => l.plafond_code ?? "—" },
  {
    tri: "locataire",
    libelle: "Ancien locataire",
    // En gras : repère principal pour retrouver un logement
    cellule: (l) => (l.nom_ancien_locataire ? <span className="font-bold text-slate-900">{l.nom_ancien_locataire}</span> : "—"),
  },
  { tri: "type", libelle: "Type", cellule: (l) => l.type_logement_code },
  { tri: "etage", libelle: "Étage", nombre: true, cellule: (l) => formatEtage(l.etage) },
  { tri: "surface", libelle: "Surface", nombre: true, cellule: (l) => formatSurface(l.surface_habitable) },
  { tri: "loyer", libelle: "Loyer", nombre: true, cellule: (l) => formatEuros(l.loyer) },
  { tri: "charges", libelle: "Charges", nombre: true, cellule: (l) => formatEuros(l.charges) },
  {
    tri: "loyer_charges",
    libelle: "Loyer + charges",
    nombre: true,
    cellule: (l) => <span className="font-medium text-slate-900">{formatEuros(l.loyer_charges)}</span>,
  },
  { tri: "preavis", libelle: "Préavis", cellule: (l) => formatDate(l.date_preavis) },
  { tri: "travaux", libelle: "Statut des travaux", cellule: (l) => <BadgeStatutTravaux code={l.statut_travaux} /> },
  { tri: "statut", libelle: "Statut du logement", cellule: (l) => <BadgeStatutLogement code={l.statut_code} /> },
  {
    tri: "commentaire",
    libelle: "Commentaire",
    cellule: (l) =>
      l.commentaire ? (
        <span className="block max-w-[16rem] truncate" title={l.commentaire}>
          {l.commentaire}
        </span>
      ) : (
        "—"
      ),
  },
];

/** Page de consultation : Archives pour un logement loué. */
const lienFiche = (l: LigneLogement) => (l.archive ? `/archives/${l.id}` : `/vacants/${l.id}`);

function Actions({ l }: { l: LigneLogement }) {
  if (l.archive) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Link href={lienFiche(l)} className="rounded px-1.5 py-1 text-sm font-medium text-primaire hover:bg-primaire-clair">
          Consulter (archives)
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <Link href={lienFiche(l)} className="rounded px-1.5 py-1 text-sm font-medium text-primaire hover:bg-primaire-clair">
        Consulter
      </Link>
      {l.statut_code === "travaux_finis" && <BoutonALouer id={l.id} numeroEsi={l.numero_esi} variante="lien" />}
      <Link
        href={`/vacants/${l.id}/modifier`}
        className="rounded px-1.5 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        Modifier
      </Link>
      <BoutonArchiver id={l.id} numeroEsi={l.numero_esi} />
    </div>
  );
}

export function TableauVacants({ lignes, etat }: { lignes: LigneLogement[]; etat: EtatListe }) {
  if (!lignes.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
        Aucun logement ne correspond à ces critères.
      </div>
    );
  }

  return (
    <>
      {/* Ordinateur / tablette */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Logements vacants</caption>
          <thead>
            <tr>
              <EnTeteColonne etat={etat} chemin="/vacants" tri="esi" libelle="N° ESI" sticky />
              {COLONNES.map((c) => (
                <EnTeteColonne key={c.libelle} etat={etat} chemin="/vacants" tri={c.tri} libelle={c.libelle} nombre={c.nombre} />
              ))}
              <th scope="col" className="sticky right-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-right text-xs font-semibold text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="group">
                <th
                  scope="row"
                  className={`sticky left-0 whitespace-nowrap border-b border-l-4 border-b-white/70 px-3 py-2 text-left font-semibold text-slate-900 ${fondLigne(l).fond} ${fondLigne(l).lisere}`}
                >
                  <Link href={lienFiche(l)} className="hover:text-primaire hover:underline">
                    {l.numero_esi}
                  </Link>
                </th>
                {COLONNES.map((c) => (
                  <td
                    key={c.libelle}
                    className={`whitespace-nowrap border-b border-white/70 px-3 py-2 text-slate-700 ${fondLigne(l).fond} ${c.nombre ? "text-right tabular-nums" : ""}`}
                  >
                    {c.cellule(l)}
                  </td>
                ))}
                <td className={`sticky right-0 whitespace-nowrap border-b border-l border-white/70 px-2 py-1.5 ${fondLigne(l).fond}`}>
                  <Actions l={l} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Téléphone */}
      <ul className="space-y-3 md:hidden">
        {lignes.map((l) => (
          <li key={l.id} className={`group rounded-lg border border-l-4 border-slate-200 p-4 ${fondLigne(l).fond} ${fondLigne(l).lisere}`}>
            <div className="flex items-start justify-between gap-3">
              <Link href={lienFiche(l)} className="font-semibold text-slate-900 hover:text-primaire">
                {l.numero_esi}
              </Link>
              <BadgeStatutLogement code={l.statut_code} />
            </div>
            {l.nom_ancien_locataire && <p className="mt-1 text-sm font-bold text-slate-900">{l.nom_ancien_locataire}</p>}
            <p className="mt-1 text-sm text-slate-600">
              {l.groupe_nom} · porte {l.porte ?? "—"} · {l.type_logement_code} · étage {formatEtage(l.etage)} · {formatSurface(l.surface_habitable)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Loyer + charges</dt>
                <dd className="font-medium text-slate-900">{formatEuros(l.loyer_charges)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Travaux</dt>
                <dd>
                  <BadgeStatutTravaux code={l.statut_travaux} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Réservataire</dt>
                <dd className="text-slate-700">{l.reservataire_nom ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Date de reprise</dt>
                <dd className="text-slate-700">{formatDate(l.date_reprise)}</dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-slate-100 pt-2">
              <Actions l={l} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
