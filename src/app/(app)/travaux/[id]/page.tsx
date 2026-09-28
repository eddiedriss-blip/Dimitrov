import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BarreProgression } from "@/components/BarreProgression";
import { BoutonALouer } from "@/components/BoutonALouer";
import { Alerte } from "@/components/formulaire";
import { estAdmin, getProfil } from "@/lib/auth/profil";
import { formatDate, formatEtage } from "@/lib/format";
import { getLogement } from "@/lib/logements/donnees";
import { chargerEntreprises, getFicheTravaux } from "@/lib/travaux/donnees";
import { ListeTravaux } from "@/components/travaux/ListeTravaux";
import { Photos } from "@/components/travaux/Photos";
import { StatutLogementManuel } from "./StatutLogementManuel";

export async function generateMetadata({ params }: PageProps<"/travaux/[id]">): Promise<Metadata> {
  const logement = await getLogement((await params).id);
  return { title: logement ? `Fiche travaux ${logement.numero_esi}` : "Fiche travaux introuvable" };
}

export default async function PageFicheTravaux({ params }: PageProps<"/travaux/[id]">) {
  const { id } = await params;
  const [fiche, entreprises, profil] = await Promise.all([getFicheTravaux(id), chargerEntreprises(), getProfil()]);
  if (!fiche) notFound();
  const { logement: l, travaux, photos } = fiche;
  if (l.archive) redirect(`/archives/${l.id}`); // loué : fiche consultable dans les Archives
  const vacanceId = l.derniere_vacance_id;
  const finis = travaux.filter((t) => t.statut_code === "fini").length;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/travaux" className="text-primaire hover:underline">
          ← Travaux des vacants
        </Link>
      </p>

      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Fiche travaux — {l.numero_esi}</h1>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5">
              <dt className="text-slate-500">Groupe</dt>
              <dd className="font-medium text-slate-900">{l.groupe_nom}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-slate-500">Étage</dt>
              <dd className="font-medium text-slate-900">{formatEtage(l.etage)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-900">{l.type_logement_libelle}</dd>
            </div>
            {l.date_liberation && (
              <div className="flex gap-1.5">
                <dt className="text-slate-500">Vacant depuis le</dt>
                <dd className="font-medium text-slate-900">{formatDate(l.date_liberation)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-sm">
            <Link href={`/vacants/${l.id}`} className="text-primaire hover:underline">
              Voir la fiche du logement →
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <StatutLogementManuel logementId={l.id} statut={l.statut_code} />
          {l.statut_code === "travaux_finis" && <BoutonALouer id={l.id} numeroEsi={l.numero_esi} />}
        </div>
      </div>

      {!vacanceId ? (
        <Alerte type="info">
          Ce logement n&apos;a pas de fiche travaux : il a été enregistré directement comme loué. Une fiche sera créée
          automatiquement s&apos;il redevient vacant.
        </Alerte>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="titre-progression" className="rounded-lg border border-slate-200 p-4">
            <h2 id="titre-progression" className="mb-3 text-base font-semibold text-slate-900">
              Progression globale
            </h2>
            <BarreProgression finis={finis} total={travaux.length} grande />
            <p className="mt-3 text-xs text-slate-500">
              Le statut du logement suit automatiquement l&apos;avancement des travaux (à faire → commandés → finis). Il reste
              modifiable à la main ci-dessus.
            </p>
          </section>

          <ListeTravaux travaux={travaux} logementId={l.id} vacanceId={vacanceId} entreprises={entreprises} estAdmin={estAdmin(profil)} />
          <Photos photos={photos} logementId={l.id} vacanceId={vacanceId} />
        </div>
      )}
    </>
  );
}
