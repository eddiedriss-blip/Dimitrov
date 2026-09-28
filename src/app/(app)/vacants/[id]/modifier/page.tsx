import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TitrePage } from "@/components/Page";
import { chargerReferentiels, getLogement } from "@/lib/logements/donnees";
import { FormulaireLogement } from "../../FormulaireLogement";

export const metadata: Metadata = { title: "Modifier un logement" };

export default async function PageModifierLogement({ params }: PageProps<"/vacants/[id]/modifier">) {
  const { id } = await params;
  const [logement, referentiels] = await Promise.all([getLogement(id), chargerReferentiels()]);
  if (!logement) notFound();
  if (logement.archive) redirect(`/archives/${logement.id}`); // loué : consultation seule

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/vacants/${logement.id}`} className="text-primaire hover:underline">
          ← Logement {logement.numero_esi}
        </Link>
      </p>
      <TitrePage titre={`Modifier le logement ${logement.numero_esi}`} description="Les champs marqués * sont obligatoires." />
      <FormulaireLogement logement={logement} referentiels={referentiels} />
    </>
  );
}
