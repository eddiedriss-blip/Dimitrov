import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgeStatutLogement } from "@/components/Badges";
import { BarreProgression } from "@/components/BarreProgression";
import { DetailsLogement } from "@/components/DetailsLogement";
import { Alerte } from "@/components/formulaire";
import { Historique } from "@/components/Historique";
import { ListeTravaux } from "@/components/travaux/ListeTravaux";
import { Photos } from "@/components/travaux/Photos";
import { formatDate, formatEuros } from "@/lib/format";
import { getEvenements } from "@/lib/historique/donnees";
import { getLogement, getVacances } from "@/lib/logements/donnees";
import { getFicheTravaux } from "@/lib/travaux/donnees";

export async function generateMetadata({ params }: PageProps<"/archives/[id]">): Promise<Metadata> {
  const logement = await getLogement((await params).id);
  return { title: logement ? `Archive ${logement.numero_esi}` : "Archive introuvable" };
}

/** Logement loué : consultation seule (la base refuse aussi toute modification). */
export default async function PageArchive({ params, searchParams }: PageProps<"/archives/[id]">) {
  const [{ id }, { info }] = await Promise.all([params, searchParams]);
  const fiche = await getFicheTravaux(id);
  if (!fiche) notFound();
  const { logement: l, travaux, photos } = fiche;
  if (!l.archive) redirect(`/vacants/${l.id}`);

  const [vacances, evenements] = await Promise.all([getVacances(l.id), getEvenements(l.id)]);
  const finis = travaux.filter((t) => t.statut_code === "fini").length;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/archives" className="text-primaire hover:underline">
          ← Archives
        </Link>
      </p>

      {info === "archive" && (
        <div className="mb-4">
          <Alerte type="succes">Logement loué : il a été déplacé dans les Archives.</Alerte>
        </div>
      )}

      <div className="mb-6 border-b border-slate-200 pb-4">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
          Logement {l.numero_esi} <BadgeStatutLogement code={l.statut_code} />
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {l.groupe_nom} ({l.groupe_code}) · loué le {formatDate(l.date_location)}
        </p>
      </div>

      <div className="mb-6">
        <Alerte type="info">Logement archivé : consultation seule. Les informations, travaux, photos et l&apos;historique sont conservés tels quels.</Alerte>
      </div>

      <div className="space-y-6">
        <DetailsLogement l={l} />

        {vacances.length > 0 && (
          <section aria-labelledby="titre-vacances" className="rounded-lg border border-slate-200">
            <h2 id="titre-vacances" className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">
              Vacances successives <span className="font-normal text-slate-500">({vacances.length})</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-600">
                    <th scope="col" className="px-4 py-2">Libéré le</th>
                    <th scope="col" className="px-3 py-2">Loué le</th>
                    <th scope="col" className="px-3 py-2 text-right">Durée</th>
                    <th scope="col" className="px-3 py-2 text-right">Travaux</th>
                    <th scope="col" className="px-4 py-2 text-right">Montant HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-200">
                  {vacances.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-2">{formatDate(v.date_debut)}</td>
                      <td className="px-3 py-2">{v.en_cours ? "En cours" : formatDate(v.date_fin)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{v.duree_jours} j</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {v.nb_travaux_finis}/{v.nb_travaux}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatEuros(v.montant_commande_ht)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {l.derniere_vacance_id && (
          <>
            <section aria-labelledby="titre-progression" className="rounded-lg border border-slate-200 p-4">
              <h2 id="titre-progression" className="mb-3 text-base font-semibold text-slate-900">
                Travaux de la dernière vacance
              </h2>
              <BarreProgression finis={finis} total={travaux.length} grande />
            </section>
            <ListeTravaux travaux={travaux} logementId={l.id} vacanceId={l.derniere_vacance_id} entreprises={[]} estAdmin={false} lectureSeule />
            <Photos photos={photos} logementId={l.id} vacanceId={l.derniere_vacance_id} lectureSeule />
          </>
        )}

        <Historique evenements={evenements} />
      </div>
    </>
  );
}
