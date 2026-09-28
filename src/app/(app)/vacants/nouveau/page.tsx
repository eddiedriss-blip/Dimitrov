import type { Metadata } from "next";
import Link from "next/link";
import { TitrePage } from "@/components/Page";
import { chargerReferentiels } from "@/lib/logements/donnees";
import { FormulaireLogement } from "../FormulaireLogement";

export const metadata: Metadata = { title: "Créer un logement" };

export default async function PageNouveauLogement() {
  const referentiels = await chargerReferentiels();
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/vacants" className="text-primaire hover:underline">
          ← Gestion des vacants
        </Link>
      </p>
      <TitrePage titre="Créer un logement" description="Les champs marqués * sont obligatoires." />
      {!referentiels.groupes.some((g) => g.actif) ? (
        <p className="rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Aucun groupe n&apos;est encore enregistré. Un administrateur doit d&apos;abord créer les groupes dans les Paramètres.
        </p>
      ) : (
        <FormulaireLogement referentiels={referentiels} />
      )}
    </>
  );
}
