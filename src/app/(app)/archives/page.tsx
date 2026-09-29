import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TitrePage } from "@/components/Page";
import { Pagination } from "@/components/Pagination";
import { estAdmin, getProfil } from "@/lib/auth/profil";
import { formatDate, formatEtage, formatEuros, formatSurface } from "@/lib/format";
import { chargerReferentiels, rechercherLogements } from "@/lib/logements/donnees";
import { lireEtat, versUrl, type CleTri, type EtatListe } from "@/lib/logements/recherche";
import type { LigneLogement } from "@/lib/logements/types";
import { FiltresArchives } from "./FiltresArchives";

export const metadata: Metadata = { title: "Archives" };

const COLONNES: { tri?: CleTri; libelle: string; nombre?: boolean; cellule: (l: LigneLogement) => ReactNode }[] = [
  { libelle: "Porte", nombre: true, cellule: (l) => l.porte ?? "—" },
  { tri: "groupe", libelle: "Groupe", cellule: (l) => l.groupe_nom },
  { tri: "reservataire", libelle: "Réservataire", cellule: (l) => l.reservataire_nom ?? "—" },
  { tri: "type", libelle: "Type", cellule: (l) => l.type_logement_code },
  { tri: "etage", libelle: "Étage", nombre: true, cellule: (l) => formatEtage(l.etage) },
  { tri: "surface", libelle: "Surface", nombre: true, cellule: (l) => formatSurface(l.surface_habitable) },
  { tri: "loyer_charges", libelle: "Loyer + charges", nombre: true, cellule: (l) => formatEuros(l.loyer_charges) },
  { tri: "locataire", libelle: "Ancien locataire", cellule: (l) => l.nom_ancien_locataire ?? "—" },
  { tri: "liberation", libelle: "Libéré le", cellule: (l) => formatDate(l.date_liberation) },
  { tri: "loue_le", libelle: "Loué le", cellule: (l) => formatDate(l.date_location) },
  { tri: "duree", libelle: "Vacance", nombre: true, cellule: (l) => (l.duree_derniere_vacance_jours === null ? "—" : `${l.duree_derniere_vacance_jours} j`) },
];

function EnTete({ etat, tri, libelle, nombre, sticky }: { etat: EtatListe; tri: CleTri; libelle: string; nombre?: boolean; sticky?: boolean }) {
  const actif = etat.tri === tri;
  return (
    <th
      scope="col"
      aria-sort={actif ? (etat.sens === "asc" ? "ascending" : "descending") : "none"}
      className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 ${nombre ? "text-right" : "text-left"} ${sticky ? "sticky left-0 z-10" : ""}`}
    >
      <Link href={`/archives${versUrl(etat, { tri, sens: actif && etat.sens === "asc" ? "desc" : "asc", page: 1 })}`} scroll={false} className={`inline-flex items-center gap-1 hover:text-slate-900 ${actif ? "text-primaire" : ""}`}>
        {libelle}
        <span aria-hidden="true" className={actif ? "" : "text-slate-300"}>
          {actif ? (etat.sens === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}

export default async function PageArchives({ searchParams }: PageProps<"/archives">) {
  const etat = lireEtat(await searchParams);
  // Archives = logements loués uniquement (filtre imposé, absent de l'URL)
  const [resultat, referentiels, profil] = await Promise.all([
    rechercherLogements({ ...etat, filtres: { ...etat.filtres, statut: "loue" } }),
    chargerReferentiels(),
    getProfil(),
  ]);
  const admin = estAdmin(profil);

  const derniere = Math.max(1, Math.ceil(resultat.total / etat.taille));
  if (etat.page > derniere) redirect(`/archives${versUrl(etat, { page: derniere })}`);

  return (
    <>
      <TitrePage titre="Archives" description={
          admin
            ? "Logements loués : toutes leurs informations sont conservées. En tant qu'administrateur, vous pouvez les modifier ou les remettre en vacance."
            : "Logements loués : toutes leurs informations sont conservées et consultables. Seul un administrateur peut les modifier."
        } />
      <FiltresArchives etat={etat} referentiels={referentiels} />

      {resultat.lignes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">Aucun logement archivé ne correspond à ces critères.</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Logements loués (archives)</caption>
              <thead>
                <tr>
                  <EnTete etat={etat} tri="esi" libelle="N° ESI" sticky />
                  {COLONNES.map((c) => (
                    c.tri ? (
                      <EnTete key={c.libelle} etat={etat} tri={c.tri} libelle={c.libelle} nombre={c.nombre} />
                    ) : (
                      <th key={c.libelle} scope="col" className={`whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 ${c.nombre ? "text-right" : "text-left"}`}>
                        {c.libelle}
                      </th>
                    )
                  ))}
                  <th scope="col" className="border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultat.lignes.map((l) => (
                  <tr key={l.id} className="group">
                    <th scope="row" className="sticky left-0 whitespace-nowrap border-b border-slate-100 bg-white px-3 py-2 text-left font-semibold text-slate-900 group-hover:bg-slate-50">
                      <Link href={`/archives/${l.id}`} className="hover:text-primaire hover:underline">
                        {l.numero_esi}
                      </Link>
                    </th>
                    {COLONNES.map((c) => (
                      <td key={c.libelle} className={`whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-700 group-hover:bg-slate-50 ${c.nombre ? "text-right tabular-nums" : ""}`}>
                        {c.cellule(l)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-right group-hover:bg-slate-50">
                      <Link href={`/archives/${l.id}`} className="rounded px-1.5 py-1 text-sm font-medium text-primaire hover:bg-primaire-clair">
                        Consulter
                      </Link>
                      {admin && (
                        <Link href={`/vacants/${l.id}/modifier`} className="rounded px-1.5 py-1 text-sm font-medium text-primaire hover:bg-primaire-clair">
                          Modifier
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {resultat.lignes.map((l) => (
              <li key={l.id}>
                <Link href={`/archives/${l.id}`} className="block rounded-lg border border-slate-200 p-4 hover:border-primaire/40">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-900">{l.numero_esi}</span>
                    <span className="text-xs text-slate-500">Loué le {formatDate(l.date_location)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {l.groupe_nom} · porte {l.porte ?? "—"} · {l.type_logement_code} · {formatEuros(l.loyer_charges)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {l.reservataire_nom ?? "Sans réservataire"} · vacance de {l.duree_derniere_vacance_jours ?? "—"} j
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination etat={etat} total={resultat.total} chemin="/archives" />
    </>
  );
}
