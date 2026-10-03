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
import { getApercusPhotos } from "@/lib/travaux/donnees";
import { ApercuPhotos } from "@/components/travaux/ApercuPhotos";
import { FiltresTravaux } from "./FiltresTravaux";

export const metadata: Metadata = { title: "Travaux des vacants" };

export default async function PageTravaux({ searchParams }: PageProps<"/travaux">) {
  const etat = lireEtat(await searchParams, TAILLES_CARTES);
  const [resultat, referentiels] = await Promise.all([rechercherLogements(etat), chargerReferentiels()]);

  const derniere = Math.max(1, Math.ceil(resultat.total / etat.taille));
  if (etat.page > derniere) redirect(`/travaux${versUrl(etat, { page: derniere })}`);
  const apercus = await getApercusPhotos(resultat.lignes.flatMap((l) => (l.derniere_vacance_id ? [l.derniere_vacance_id] : [])));

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
            <li
              key={l.id}
              className="relative flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primaire hover:border-primaire/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Lien étendu à toute la carte (after:inset-0) ; les flèches du carrousel passent au-dessus */}
                <Link href={`/travaux/${l.id}`} className="text-base font-semibold text-slate-900 outline-none after:absolute after:inset-0 after:rounded-lg">
                  {l.numero_esi}
                </Link>
                <BadgeStatutLogement code={l.statut_code} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{l.groupe_nom}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <dl className="flex gap-5 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Porte</dt>
                    <dd className="font-medium text-slate-900">{l.porte ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Étage</dt>
                    <dd className="font-medium text-slate-900">{formatEtage(l.etage)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Type</dt>
                    <dd className="font-medium text-slate-900">{l.type_logement_code}</dd>
                  </div>
                </dl>
                {l.derniere_vacance_id && <ApercuPhotos photos={apercus[l.derniere_vacance_id] ?? []} />}
              </div>
              <div className="mt-auto pt-4">
                <BarreProgression finis={l.nb_travaux_finis} total={l.nb_travaux} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination etat={etat} total={resultat.total} chemin="/travaux" />
    </>
  );
}
