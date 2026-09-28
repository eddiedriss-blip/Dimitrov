import { EnTete } from "@/components/EnTete";
import { SurveillanceSession } from "@/components/SurveillanceSession";
import { modeTestActif } from "@/lib/auth/modeTest";
import { getProfil, nomAffiche } from "@/lib/auth/profil";
import { LIBELLES_ROLE, menuPourRole } from "@/lib/navigation";

export default async function LayoutApplication({ children }: LayoutProps<"/">) {
  const profil = await getProfil();

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <EnTete
        menu={menuPourRole(profil.role)}
        utilisateur={{ nom: nomAffiche(profil), role: LIBELLES_ROLE[profil.role] }}
      />
      {modeTestActif() && (
        <p className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900">
          Mode test : accès sans identifiants activé — n&apos;utiliser que des données fictives.
        </p>
      )}
      <main className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      <SurveillanceSession />
    </div>
  );
}
