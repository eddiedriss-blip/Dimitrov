import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BadgeStatutLogement } from "@/components/Badges";
import { Alerte } from "@/components/formulaire";
import { ListeTravaux } from "@/components/travaux/ListeTravaux";
import { PhotosTelephone } from "@/components/travaux/PhotosTelephone";
import { estAdmin, getProfil } from "@/lib/auth/profil";
import { chargerReferentiels, getLogement } from "@/lib/logements/donnees";
import { chargerEntreprises, getFicheTravaux } from "@/lib/travaux/donnees";
import { FormulaireLogement } from "../../vacants/FormulaireLogement";

export async function generateMetadata({ params }: PageProps<"/telephone/[id]">): Promise<Metadata> {
  const logement = await getLogement((await params).id);
  return { title: logement ? `${logement.numero_esi} — Téléphone` : "Logement introuvable" };
}

const MESSAGES: Record<string, string> = {
  cree: "Logement créé. Vous pouvez maintenant ajouter les photos.",
  modifie: "Infos enregistrées.",
};

/** Bloc repliable à grande zone de toucher. */
function Volet({ titre, children }: { titre: ReactNode; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 text-lg font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        {titre}
        <span aria-hidden="true" className="text-slate-400 transition group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t border-slate-200 p-4">{children}</div>
    </details>
  );
}

export default async function PageTelephoneLogement({ params, searchParams }: PageProps<"/telephone/[id]">) {
  const [{ id }, { info }] = await Promise.all([params, searchParams]);
  const [fiche, referentiels, entreprises, profil] = await Promise.all([getFicheTravaux(id), chargerReferentiels(), chargerEntreprises(), getProfil()]);
  if (!fiche) notFound();
  const { logement: l, travaux, photos } = fiche;
  // Loué : consultation dans les Archives (photos et travaux verrouillés)
  if (l.archive) redirect(`/archives/${l.id}`);
  const message = typeof info === "string" ? MESSAGES[info] : undefined;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <Link href="/telephone" className="text-sm text-primaire">
          ← Autre logement
        </Link>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold text-slate-900">
          {l.numero_esi} <BadgeStatutLogement code={l.statut_code} />
        </h1>
        <p className="mt-1 text-sm">
          {l.nom_ancien_locataire ? (
            <strong className="text-slate-800">{l.nom_ancien_locataire}</strong>
          ) : (
            <span className="text-slate-400">Ancien locataire non renseigné</span>
          )}
          <span className="text-slate-500">
            {" "}
            · {l.groupe_nom} · porte {l.porte ?? "—"}
          </span>
        </p>
      </div>

      {message && <Alerte type="succes">{message}</Alerte>}

      {l.derniere_vacance_id ? (
        <>
          <PhotosTelephone photos={photos} logementId={l.id} vacanceId={l.derniere_vacance_id} />
          <Volet
            titre={
              <span>
                Travaux <span className="font-normal text-slate-500">({travaux.length})</span>
              </span>
            }
          >
            <ListeTravaux travaux={travaux} logementId={l.id} vacanceId={l.derniere_vacance_id} entreprises={entreprises} estAdmin={estAdmin(profil)} />
          </Volet>
        </>
      ) : (
        <Alerte type="info">Ce logement n&apos;a pas de vacance en cours : impossible d&apos;y ajouter des photos.</Alerte>
      )}

      <Volet titre="Infos du logement">
        <FormulaireLogement logement={l} referentiels={referentiels} vue="telephone" />
      </Volet>

      <p className="pb-4 text-center text-sm">
        <Link href={`/vacants/${l.id}`} className="text-primaire">
          Ouvrir la fiche complète
        </Link>
      </p>
    </div>
  );
}
