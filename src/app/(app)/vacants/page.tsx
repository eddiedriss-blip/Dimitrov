import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitrePage } from "@/components/Page";
import { Pagination } from "@/components/Pagination";
import { chargerReferentiels, rechercherLogements } from "@/lib/logements/donnees";
import { lireEtat, versUrl } from "@/lib/logements/recherche";
import { FiltresVacants } from "./FiltresVacants";
import { TableauVacants } from "./TableauVacants";

export const metadata: Metadata = { title: "Gestion des vacants" };

export default async function PageVacants({ searchParams }: PageProps<"/vacants">) {
  const etat = lireEtat(await searchParams);
  const [resultat, referentiels] = await Promise.all([rechercherLogements(etat), chargerReferentiels()]);

  // Page au-delà de la dernière (ex. après un filtre) : revenir à la dernière page existante.
  const derniere = Math.max(1, Math.ceil(resultat.total / etat.taille));
  if (etat.page > derniere) redirect(`/vacants${versUrl(etat, { page: derniere })}`);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <TitrePage titre="Gestion des vacants" description="Logements vacants : caractéristiques, réservataire, statut et travaux." sansBordure />
        <Link
          href="/vacants/nouveau"
          className="inline-flex items-center justify-center rounded-md bg-primaire px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primaire-fonce"
        >
          + Créer un logement
        </Link>
      </div>
      <FiltresVacants etat={etat} referentiels={referentiels} />
      <TableauVacants lignes={resultat.lignes} etat={etat} />
      <Pagination etat={etat} total={resultat.total} chemin="/vacants" />
    </>
  );
}
