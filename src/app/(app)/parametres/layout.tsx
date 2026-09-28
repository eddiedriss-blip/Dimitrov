import { Alerte } from "@/components/formulaire";
import { TitrePage } from "@/components/Page";
import { estAdmin, getProfil } from "@/lib/auth/profil";
import { OngletsParametres } from "./OngletsParametres";

/** Paramètres : administrateurs uniquement (le menu les masque, chaque action le vérifie, la base aussi). */
export default async function LayoutParametres({ children }: LayoutProps<"/parametres">) {
  const profil = await getProfil();
  if (!estAdmin(profil)) {
    return (
      <>
        <TitrePage titre="Paramètres" />
        <Alerte type="erreur">Cette page est réservée aux administrateurs.</Alerte>
      </>
    );
  }
  return (
    <>
      <TitrePage titre="Paramètres" description="Comptes utilisateurs et listes déroulantes de l'application." />
      <OngletsParametres />
      {children}
    </>
  );
}
