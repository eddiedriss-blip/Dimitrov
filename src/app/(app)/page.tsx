import type { Metadata } from "next";
import { Alerte } from "@/components/formulaire";
import { ContenuAVenir, TitrePage } from "@/components/Page";
import { getProfil } from "@/lib/auth/profil";

export const metadata: Metadata = { title: "Accueil" };

export default async function PageAccueil({ searchParams }: PageProps<"/">) {
  const [profil, { info }] = await Promise.all([getProfil(), searchParams]);

  return (
    <>
      {info === "mot-de-passe-modifie" && (
        <div className="mb-6">
          <Alerte type="succes">Votre mot de passe a bien été modifié.</Alerte>
        </div>
      )}
      <TitrePage titre={profil.prenom ? `Bonjour ${profil.prenom}` : "Accueil"} description="Vue d'ensemble des logements vacants." />
      <ContenuAVenir />
    </>
  );
}
