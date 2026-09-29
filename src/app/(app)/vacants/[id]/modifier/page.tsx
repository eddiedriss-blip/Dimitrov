import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TitrePage } from "@/components/Page";
import { estAdmin, getProfil } from "@/lib/auth/profil";
import { chargerReferentiels, getLogement } from "@/lib/logements/donnees";
import { FormulaireLogement } from "../../FormulaireLogement";

export const metadata: Metadata = { title: "Modifier un logement" };

export default async function PageModifierLogement({ params }: PageProps<"/vacants/[id]/modifier">) {
  const { id } = await params;
  const [logement, referentiels, profil] = await Promise.all([getLogement(id), chargerReferentiels(), getProfil()]);
  if (!logement) notFound();
  // Loué (archivé) : modifiable par un administrateur seulement (règle aussi imposée par la base).
  if (logement.archive && !estAdmin(profil)) redirect(`/archives/${logement.id}`);
  const fiche = logement.archive ? `/archives/${logement.id}` : `/vacants/${logement.id}`;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={fiche} className="text-primaire hover:underline">
          ← Logement {logement.numero_esi}
        </Link>
      </p>
      <TitrePage
        titre={`Modifier le logement ${logement.numero_esi}`}
        description={
          logement.archive
            ? "Logement archivé (loué). Pour le remettre en vacance, changez son statut : une nouvelle vacance sera ouverte."
            : "Les champs marqués * sont obligatoires."
        }
      />
      <FormulaireLogement logement={logement} referentiels={referentiels} />
    </>
  );
}
