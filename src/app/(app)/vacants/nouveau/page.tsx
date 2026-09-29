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
      {/* Pas de prérequis : le groupe est déduit du N° ESI (et créé s'il n'existe pas). */}
      <FormulaireLogement referentiels={referentiels} />
    </>
  );
}
