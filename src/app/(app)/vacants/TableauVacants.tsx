import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeStatutLogement, BadgeStatutTravaux } from "@/components/Badges";
import { formatDate, formatEtage, formatEuros, formatSurface } from "@/lib/format";
import { versUrl, type CleTri, type EtatListe } from "@/lib/logements/recherche";
import type { LigneLogement } from "@/lib/logements/types";
import { BoutonALouer } from "@/components/BoutonALouer";
import { BoutonArchiver } from "./BoutonArchiver";

type Colonne = {
  tri: CleTri;
  libelle: string;
  nombre?: boolean;
  cellule: (l: LigneLogement) => ReactNode;
};

const COLONNES: Colonne[] = [
  { tri: "groupe", libelle: "Groupe", cellule: (l) => <span title={l.groupe_code}>{l.groupe_nom}</span> },
  { tri: "reservataire", libelle: "Réservataire", cellule: (l) => l.reservataire_nom ?? "—" },
  { tri: "envoi", libelle: "Envoi au réservataire", cellule: (l) => formatDate(l.date_envoi_reservataire) },
  { tri: "reprise", libelle: "Date de reprise", cellule: (l) => formatDate(l.date_reprise) },
  { tri: "plafond", libelle: "Plafond", cellule: (l) => l.plafond_code ?? "—" },
  { tri: "locataire", libelle: "Ancien locataire", cellule: (l) => l.nom_ancien_locataire ?? "—" },
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

function EnTeteTri({ etat, tri, libelle, nombre, sticky }: { etat: EtatListe; tri: CleTri; libelle: string; nombre?: boolean; sticky?: boolean }) {
  const actif = etat.tri === tri;
  const sens = actif && etat.sens === "asc" ? "desc" : "asc";
  return (
    <th
      scope="col"
      aria-sort={actif ? (etat.sens === "asc" ? "ascending" : "descending") : "none"}
      className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 ${nombre ? "text-right" : "text-left"} ${sticky ? "sticky left-0 z-10" : ""}`}
    >
      <Link
        href={`/vacants${versUrl(etat, { tri, sens, page: 1 })}`}
        scroll={false}
        className={`group inline-flex items-center gap-1 hover:text-slate-900 ${actif ? "text-primaire" : ""}`}
        title={`Trier par ${libelle.toLowerCase()} (${sens === "asc" ? "croissant" : "décroissant"})`}
      >
        {libelle}
        <span aria-hidden="true" className={actif ? "" : "text-slate-300 group-hover:text-slate-400"}>
          {actif ? (etat.sens === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}

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
              <EnTeteTri etat={etat} tri="esi" libelle="N° ESI" sticky />
              {COLONNES.map((c) => (
                <EnTeteTri key={c.tri} etat={etat} tri={c.tri} libelle={c.libelle} nombre={c.nombre} />
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
                  className="sticky left-0 whitespace-nowrap border-b border-slate-100 bg-white px-3 py-2 text-left font-semibold text-slate-900 group-hover:bg-slate-50"
                >
                  <Link href={lienFiche(l)} className="hover:text-primaire hover:underline">
                    {l.numero_esi}
                  </Link>
                </th>
                {COLONNES.map((c) => (
                  <td
                    key={c.tri}
                    className={`whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700 group-hover:bg-slate-50 ${c.nombre ? "text-right tabular-nums" : ""}`}
                  >
                    {c.cellule(l)}
                  </td>
                ))}
                <td className="sticky right-0 whitespace-nowrap border-b border-l border-slate-100 bg-white px-2 py-1.5 group-hover:bg-slate-50">
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
          <li key={l.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={lienFiche(l)} className="font-semibold text-slate-900 hover:text-primaire">
                {l.numero_esi}
              </Link>
              <BadgeStatutLogement code={l.statut_code} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {l.groupe_nom} · {l.type_logement_code} · étage {formatEtage(l.etage)} · {formatSurface(l.surface_habitable)}
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
