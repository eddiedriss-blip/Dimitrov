import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BadgeStatutLogement } from "@/components/Badges";
import { BoutonALouer } from "@/components/BoutonALouer";
import { DetailsLogement } from "@/components/DetailsLogement";
import { Alerte } from "@/components/formulaire";
import { Historique } from "@/components/Historique";
import { getEvenements } from "@/lib/historique/donnees";
import { getLogement } from "@/lib/logements/donnees";
import { BoutonArchiver } from "../BoutonArchiver";

export async function generateMetadata({ params }: PageProps<"/vacants/[id]">): Promise<Metadata> {
  const logement = await getLogement((await params).id);
  return { title: logement ? `Logement ${logement.numero_esi}` : "Logement introuvable" };
}

const MESSAGES: Record<string, string> = {
  cree: "Le logement a été créé.",
  modifie: "Les modifications ont été enregistrées.",
};

export default async function PageLogement({ params, searchParams }: PageProps<"/vacants/[id]">) {
  const [{ id }, { info }] = await Promise.all([params, searchParams]);
  const l = await getLogement(id);
  if (!l) notFound();
  // Un logement loué est « déplacé » dans les Archives (consultation seule).
  if (l.archive) redirect(`/archives/${l.id}${info ? "?info=archive" : ""}`);

  const evenements = await getEvenements(l.id);
  const message = typeof info === "string" ? MESSAGES[info] : undefined;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/vacants" className="text-primaire hover:underline">
          ← Gestion des vacants
        </Link>
      </p>

      {message && (
        <div className="mb-4">
          <Alerte type="succes">{message}</Alerte>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-slate-900">
            Logement {l.numero_esi} <BadgeStatutLogement code={l.statut_code} />
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {l.groupe_nom} ({l.groupe_code}){l.adresse ? ` · ${l.adresse}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {l.statut_code === "travaux_finis" && <BoutonALouer id={l.id} numeroEsi={l.numero_esi} />}
          <Link
            href={`/vacants/${l.id}/modifier`}
            className="rounded-md bg-primaire px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce"
          >
            Modifier
          </Link>
          <Link
            href={`/travaux/${l.id}`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Fiche travaux
          </Link>
          <BoutonArchiver id={l.id} numeroEsi={l.numero_esi} variante="bouton" retour={`/archives/${l.id}?info=archive`} />
        </div>
      </div>

      <div className="space-y-6">
        <DetailsLogement l={l} />
        <Historique evenements={evenements} />
      </div>
    </>
  );
}
