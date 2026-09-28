import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeStatutLogement } from "@/components/Badges";
import { BarreProgression } from "@/components/BarreProgression";
import { TitrePage } from "@/components/Page";
import { Pagination } from "@/components/Pagination";
import { formatEtage } from "@/lib/format";
import { chargerReferentiels, rechercherLogements } from "@/lib/logements/donnees";
import { lireEtat, TAILLES_CARTES, versUrl } from "@/lib/logements/recherche";
import { FiltresTravaux } from "./FiltresTravaux";

export const metadata: Metadata = { title: "Travaux des vacants" };

export default async function PageTravaux({ searchParams }: PageProps<"/travaux">) {
  const etat = lireEtat(await searchParams, TAILLES_CARTES);
  const [resultat, referentiels] = await Promise.all([rechercherLogements(etat), chargerReferentiels()]);

  const derniere = Math.max(1, Math.ceil(resultat.total / etat.taille));
  if (etat.page > derniere) redirect(`/travaux${versUrl(etat, { page: derniere })}`);

  return (
    <>
      <TitrePage titre="Travaux des vacants" description="Avancement des travaux par logement. Cliquez sur une carte pour ouvrir la fiche travaux." />
      <FiltresTravaux etat={etat} referentiels={referentiels} />

      {resultat.lignes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
          Aucun logement ne correspond à ces critères.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {resultat.lignes.map((l) => (
            <li key={l.id}>
              <Link
                href={`/travaux/${l.id}`}
                className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primaire/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaire"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-base font-semibold text-slate-900">{l.numero_esi}</span>
                  <BadgeStatutLogement code={l.statut_code} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{l.groupe_nom}</p>
                <dl className="mt-3 flex gap-6 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Étage</dt>
                    <dd className="font-medium text-slate-900">{formatEtage(l.etage)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Type</dt>
                    <dd className="font-medium text-slate-900">{l.type_logement_code}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-4">
                  <BarreProgression finis={l.nb_travaux_finis} total={l.nb_travaux} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination etat={etat} total={resultat.total} chemin="/travaux" />
    </>
  );
}
