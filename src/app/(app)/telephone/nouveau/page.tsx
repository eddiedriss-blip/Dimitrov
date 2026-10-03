import type { Metadata } from "next";
import Link from "next/link";
import { chargerReferentiels } from "@/lib/logements/donnees";
import { FormulaireLogement } from "../../vacants/FormulaireLogement";

export const metadata: Metadata = { title: "Nouveau logement" };

export default async function PageTelephoneNouveau() {
  const referentiels = await chargerReferentiels();
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/telephone" className="text-sm text-primaire">
        ← Retour
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Nouveau logement</h1>
      <p className="mb-6 mt-1 text-sm text-slate-600">Seuls le N° ESI et le type sont obligatoires : le reste peut être complété plus tard.</p>
      <FormulaireLogement referentiels={referentiels} vue="telephone" />
    </div>
  );
}
